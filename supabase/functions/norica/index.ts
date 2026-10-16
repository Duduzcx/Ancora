// Edge Function "norica": toda a parte sensível do app passa por aqui.
// - Exige login (token do Supabase Auth) em todas as ações.
// - Guarda a chave da IA no servidor (o app não carrega mais nenhuma chave).
// - Criptografa mensagens, títulos e Cofre antes de salvar no banco.
// - Aplica o protocolo de crise antes de responder.
//
// Deploy:  supabase functions deploy norica
// Secrets: supabase secrets set GROQ_API_KEY=... NORICA_ENCRYPTION_KEY=...

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decrypt, encrypt } from "../_shared/crypto.ts";
import { CHAT_MODEL, type ChatMessage, FAST_MODEL, groqChat, groqChatStream, parseJsonObject, TRANSCRIBE_MODEL } from "../_shared/groq.ts";
import { firstNameFrom } from "../_shared/names.ts";
import { consume, getPlan, launchMode, PLAN_LIMITS, usageToday } from "../_shared/plans.ts";
import { checkSubscription, PRO_PRODUCT_ID } from "../_shared/google-play.ts";
import { synthesize, TTS_VOICES, ttsConfigured } from "../_shared/tts.ts";
import {
  arenaFeedbackPrompt,
  arenaSystemPrompt,
  claraSystemPrompt,
  DAILY_LOG_PROMPT,
  LOG_INSIGHT_PROMPT,
  type ChatMode,
  detectRisk,
  MEMORY_PROMPT,
  MODES,
  portoSystemPrompt,
  PROMPT_VERSION,
  RISK_PROMPT,
  type RiskLevel,
  TASKS_PROMPT,
  TITLE_PROMPT,
  CONVERSATION_PREP_PROMPT,
  VOICE_JOURNAL_PROMPT,
  WEEKLY_PROMPT,
  MONTHLY_PROMPT,
} from "../_shared/safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_MESSAGE_CHARS = 4000;
const HISTORY_LIMIT = 30;
const MAX_USER_MESSAGES_PER_MINUTE = 12;
const VALID_MOODS = ["calmo", "ansioso", "agitado", "sos"];

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, max = MAX_MESSAGE_CHARS): string {
  if (typeof value !== "string") throw new HttpError(400, "Texto inválido");
  const text = value.trim();
  if (!text) throw new HttpError(400, "Texto vazio");
  if (text.length > max) throw new HttpError(413, `Texto muito longo (máximo ${max} caracteres)`);
  return text;
}

function cleanTranscript(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));
}

type Ctx = {
  db: SupabaseClient; // cliente com o login do usuário (respeita RLS)
  admin: SupabaseClient; // service role: planos, uso e exclusão de conta
  userId: string;
  email: string | null;
  meta: Record<string, unknown>;
};

async function personName(ctx: Ctx): Promise<string | null> {
  const { data } = await ctx.db.from("profiles").select("display_name").eq("id", ctx.userId).maybeSingle();
  return firstNameFrom(ctx.meta, data?.display_name ?? null, ctx.email);
}

// ---------------------------------------------------------------------
// Porto (chat)
// ---------------------------------------------------------------------

async function assertOwnChat(ctx: Ctx, chatId: string) {
  const { data, error } = await ctx.db.from("chats").select("id").eq("id", chatId).eq("user_id", ctx.userId).maybeSingle();
  if (error || !data) throw new HttpError(404, "Conversa não encontrada");
}

async function rateLimit(ctx: Ctx, crisisBypass = false) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await ctx.db
    .from("messages")
    .select("id, chats!inner(user_id)", { count: "exact", head: true })
    .eq("chats.user_id", ctx.userId)
    .eq("role", "user")
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_USER_MESSAGES_PER_MINUTE && !crisisBypass) {
    throw new HttpError(429, "Muitas mensagens em pouco tempo. Respire um pouco e tente de novo.");
  }
}

async function extractTasks(reply: string): Promise<string[]> {
  // Só vale a pena quando a resposta tem cara de lista de passos.
  if (!/(^|\n)\s*([-*•]|\d+[.)])\s+/.test(reply)) return [];
  try {
    const raw = await groqChat(
      [{ role: "system", content: TASKS_PROMPT }, { role: "user", content: reply }],
      { model: FAST_MODEL, temperature: 0.2, maxTokens: 200 },
    );
    const parsed = parseJsonObject(raw);
    if (!parsed || !Array.isArray(parsed.tasks)) return [];
    return (parsed.tasks as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().replace(/[.!]$/, "").slice(0, 60))
      .slice(0, 4);
  } catch (_e) {
    return [];
  }
}

function runInBackground(task: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(task.catch((e) => console.error(e)));
  else task.catch((e) => console.error(e));
}

// Resumo emocional do dia (tabela daily_logs, lida pelo Farol): humor, assunto e um conselho curto.
async function updateDailyLog(ctx: Ctx, transcript: ChatMessage[]) {
  const text = transcript.map((m) => `${m.role}: ${m.content}`).join("\n");
  const raw = await groqChat(
    [{ role: "system", content: DAILY_LOG_PROMPT }, { role: "user", content: text }],
    { model: FAST_MODEL, temperature: 0.3, maxTokens: 150 },
  );
  const parsed = parseJsonObject(raw);
  const humor = typeof parsed?.humor_predominante === "string" ? parsed.humor_predominante : null;
  if (!humor || !VALID_MOODS.includes(humor)) return;
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // dia em Brasília
  await ctx.db.from("daily_logs").upsert({
    user_id: ctx.userId,
    date: today,
    humor,
    assunto: typeof parsed?.assunto_principal === "string" ? parsed.assunto_principal.slice(0, 60) : null,
    conselho: typeof parsed?.conselho_curto === "string" ? parsed.conselho_curto.slice(0, 160) : null,
  }, { onConflict: "user_id,date" });
}

type PreparedChat = {
  chatId: string;
  isNewChat: boolean;
  history: ChatMessage[];
  message: string;
  crisis: boolean;
  risk: RiskLevel;
  mode: ChatMode | null;
  memoryEnabled: boolean;
  memory: string;
  userMessageId: string | null;
  system: string;
};

/** Promessa com prazo: se a IA auxiliar demorar, segue sem ela (a resposta principal não pode esperar). */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

// Segunda checagem de risco, feita por um modelo rápido: pega frases indiretas
// ("queria dormir e não acordar") que as palavras-chave não pegam.
async function classifyRisk(history: ChatMessage[], message: string): Promise<RiskLevel> {
  if (message.length < 8) return "nenhum";
  const recent = history.slice(-4).map((m) => `${m.role === "user" ? "Pessoa" : "Nórica"}: ${m.content.slice(0, 400)}`).join("\n");
  const raw = await groqChat(
    [
      { role: "system", content: RISK_PROMPT },
      { role: "user", content: `${recent ? `Contexto:\n${recent}\n\n` : ""}ÚLTIMA mensagem da pessoa: ${message}` },
    ],
    { model: FAST_MODEL, temperature: 0, maxTokens: 20 },
  );
  const risco = parseJsonObject(raw)?.risco;
  return risco === "alto" || risco === "atencao" ? risco : "nenhum";
}

const MOOD_WORD: Record<string, string> = { calmo: "calmo", ansioso: "ansioso", agitado: "agitado", sos: "em crise (S.O.S)" };

// O que o app sabe dos últimos 7 dias, em poucas linhas, para a Nórica conhecer o momento da pessoa.
async function buildContext(ctx: Ctx): Promise<string> {
  const since = new Date(Date.now() - 7 * 86400_000);
  const sinceDay = new Date(since.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const [{ data: moods }, { data: habits }, { data: days }] = await Promise.all([
    ctx.db.from("mood_logs").select("mood, created_at").eq("user_id", ctx.userId).gte("created_at", since.toISOString())
      .order("created_at", { ascending: true }),
    ctx.db.from("habit_logs").select("day, progress").eq("user_id", ctx.userId).gte("day", sinceDay),
    ctx.db.from("daily_logs").select("date, humor, assunto").eq("user_id", ctx.userId).gte("date", sinceDay)
      .order("date", { ascending: false }).limit(5),
  ]);
  const lines: string[] = [];
  if (moods?.length) {
    const counts = new Map<string, number>();
    for (const m of moods) counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
    const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${MOOD_WORD[k] ?? k} ${n}x`);
    const last = moods[moods.length - 1];
    // Sequência de dias seguidos com o mesmo humor difícil (ex.: "ansioso 3 dias seguidos").
    const byDay = new Map<string, string>();
    for (const m of moods) byDay.set(new Date(new Date(m.created_at).getTime() - 3 * 3600_000).toISOString().slice(0, 10), m.mood);
    const ordered = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    let streak = 0;
    for (const [, mood] of ordered) { if (mood === ordered[0][1]) streak++; else break; }
    lines.push(`- Humor marcado na Início nos últimos 7 dias: ${parts.join(", ")}. Último: ${MOOD_WORD[last.mood] ?? last.mood}${streak >= 2 && ordered[0][1] !== "calmo" ? ` (${streak} dias seguidos)` : ""}.`);
  }
  if (habits?.length) {
    const active = habits.filter((h) => Number(h.progress) > 0).length;
    lines.push(`- Cuidou de si nos Logs (hábitos marcados) em ${active} dos últimos 7 dias.`);
  }
  const topics = (days ?? []).map((d) => d.assunto).filter((a): a is string => !!a);
  if (topics.length) lines.push(`- Assuntos das conversas recentes: ${[...new Set(topics)].slice(0, 3).join(", ")}.`);
  return lines.join("\n");
}

async function loadMemory(ctx: Ctx): Promise<{ enabled: boolean; content: string }> {
  const { data } = await ctx.db.from("user_memory").select("content, enabled").eq("user_id", ctx.userId).maybeSingle();
  if (!data) return { enabled: true, content: "" };
  return { enabled: data.enabled !== false, content: data.enabled === false ? "" : await decrypt(data.content) };
}

// Atualiza a memória entre conversas (em segundo plano, depois da resposta).
async function updateMemory(ctx: Ctx, current: string, transcript: ChatMessage[]) {
  const text = transcript.slice(-16).map((m) => `${m.role === "user" ? "Pessoa" : "Nórica"}: ${m.content.slice(0, 600)}`).join("\n");
  const raw = await groqChat(
    [
      { role: "system", content: MEMORY_PROMPT },
      { role: "user", content: `MEMÓRIA ATUAL:\n${current || "(vazio)"}\n\nCONVERSA NOVA:\n${text}` },
    ],
    { model: FAST_MODEL, temperature: 0.2, maxTokens: 400 },
  );
  const cleaned = raw.trim();
  if (!cleaned) return;
  const content = cleaned === "(vazio)" ? "" : cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .slice(0, 12)
    .join("\n")
    .slice(0, 900);
  if (!content && cleaned !== "(vazio)") return; // resposta fora do formato: mantém a memória como estava
  // Não sobrescreve se a pessoa desligou ou apagou a memória enquanto a IA trabalhava.
  const { data: row } = await ctx.db.from("user_memory").select("enabled").eq("user_id", ctx.userId).maybeSingle();
  if (row && row.enabled === false) return;
  await ctx.db.from("user_memory").upsert({
    user_id: ctx.userId,
    content: await encrypt(content),
    enabled: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

const CRISIS_FALLBACK =
  "Estou aqui com você. O que você está sentindo é sério e você merece ajuda agora: **ligue 188 (CVV)**, é gratuito e funciona 24h. Se estiver em perigo imediato, **ligue 192**. Você está em segurança neste momento?";
const ERROR_FALLBACK = "Tive um problema na navegação agora. Pode me contar de novo? ⚓";

// Parte 1 da conversa: valida, abre/confere a conversa, aplica limites e salva a mensagem da pessoa.
async function prepareChat(ctx: Ctx, body: Record<string, unknown>): Promise<PreparedChat> {
  const regenerate = body.regenerate === true; // depois de editar uma mensagem: responde de novo, sem salvar outra
  const mood = typeof body.mood === "string" && VALID_MOODS.includes(body.mood) ? body.mood : null;
  const persona = body.persona === "clara" ? "clara" : "norica";
  const requestedMode = typeof body.mode === "string" && (MODES as readonly string[]).includes(body.mode) ? body.mode as ChatMode : null;
  let chatId = typeof body.chatId === "string" && body.chatId ? body.chatId : null;
  if (regenerate && !chatId) throw new HttpError(400, "Conversa não encontrada");

  let isNewChat = false;
  let mode: ChatMode | null = requestedMode;
  if (chatId) {
    const { data: chatRow, error: chatError } = await ctx.db.from("chats").select("id, mode").eq("id", chatId).eq("user_id", ctx.userId).maybeSingle();
    if (chatError || !chatRow) throw new HttpError(404, "Conversa não encontrada");
    if (requestedMode && requestedMode !== chatRow.mode) {
      await ctx.db.from("chats").update({ mode: requestedMode }).eq("id", chatId);
    }
    mode = requestedMode ?? ((MODES as readonly string[]).includes(chatRow.mode) ? chatRow.mode as ChatMode : null);
  } else {
    const { data, error } = await ctx.db
      .from("chats")
      .insert({ user_id: ctx.userId, title: await encrypt("Nova conversa"), ...(mode ? { mode } : {}) })
      .select("id")
      .single();
    if (error || !data) throw new HttpError(500, "Não foi possível abrir a conversa");
    chatId = data.id;
    isNewChat = true;
    // Saudação inicial mostrada no app também fica salva na conversa.
    if (typeof body.welcome === "string" && body.welcome.trim()) {
      await ctx.db.from("messages").insert({ chat_id: chatId, role: "assistant", content: await encrypt(body.welcome.slice(0, 2000)) });
    }
  }

  // Histórico anterior (descriptografado) para dar contexto ao modelo.
  const { data: rows } = await ctx.db
    .from("messages")
    .select("role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history: ChatMessage[] = [];
  for (const r of (rows ?? []).reverse()) {
    if (r.role === "user" || r.role === "assistant") {
      history.push({ role: r.role, content: await decrypt(r.content) });
    }
  }

  let message: string;
  let userMessageId: string | null = null;
  if (regenerate) {
    const last = history.pop();
    if (!last || last.role !== "user") throw new HttpError(400, "Nada para responder");
    message = last.content;
  } else {
    message = cleanText(body.message);
  }

  const keywordRisk = detectRisk(message);
  // Tudo em paralelo: checagem de risco pela IA, nome, contexto dos últimos dias e memória.
  const [aiRisk, name, context, memoryInfo] = await Promise.all([
    keywordRisk ? Promise.resolve<RiskLevel>("alto") : withTimeout(classifyRisk(history, message), 2500, "nenhum" as RiskLevel),
    personName(ctx),
    withTimeout(buildContext(ctx), 2000, ""),
    withTimeout(loadMemory(ctx), 2000, { enabled: true, content: "" }),
  ]);
  const risk: RiskLevel = keywordRisk ? "alto" : aiRisk;
  const crisis = risk === "alto";
  await rateLimit(ctx, crisis);
  // Limite do plano Gratuito (desligado no lançamento). Mensagens com sinal de risco nunca são bloqueadas.
  if (!crisis) {
    const limitMessage = await consume(ctx.admin, ctx.userId, "porto_message");
    if (limitMessage) throw new HttpError(429, limitMessage);
  }

  if (!regenerate) {
    const { data: inserted, error: insertUserError } = await ctx.db
      .from("messages")
      .insert({ chat_id: chatId, role: "user", content: await encrypt(message) })
      .select("id")
      .single();
    if (insertUserError) throw new HttpError(500, "Não foi possível salvar a mensagem");
    userMessageId = inserted?.id ?? null;
  }

  const promptOptions = { mood, crisis, risk, name, mode, context, memory: memoryInfo.content };
  const system = persona === "clara" ? claraSystemPrompt(promptOptions) : portoSystemPrompt(promptOptions);
  return {
    chatId: chatId!,
    isNewChat,
    history,
    message,
    crisis,
    risk,
    mode,
    memoryEnabled: memoryInfo.enabled,
    memory: memoryInfo.content,
    userMessageId,
    system,
  };
}

// Parte 2: salva a resposta, dá título à conversa, atualiza o resumo do dia e sugere passos.
async function finishChat(ctx: Ctx, prep: PreparedChat, rawReply: string) {
  const { chatId, isNewChat, history, message, crisis, userMessageId } = prep;
  const reply = rawReply || (crisis ? CRISIS_FALLBACK : ERROR_FALLBACK);

  const { data: botRow } = await ctx.db
    .from("messages")
    .insert({ chat_id: chatId, role: "assistant", content: await encrypt(reply) })
    .select("id")
    .single();

  let title: string | null = null;
  const userTurns = history.filter((m) => m.role === "user").length + 1;
  if (isNewChat || userTurns === 1) {
    try {
      title = (await groqChat(
        [{ role: "system", content: TITLE_PROMPT }, { role: "user", content: message }],
        { model: FAST_MODEL, temperature: 0.4, maxTokens: 20 },
      )).replace(/["'.]/g, "").slice(0, 60);
    } catch (_e) {
      title = null;
    }
    if (!title || crisis) title = crisis ? "Momento difícil" : "Nova conversa";
    await ctx.db.from("chats").update({ title: await encrypt(title) }).eq("id", chatId);
  }

  const transcript: ChatMessage[] = [...history, { role: "user", content: message }, { role: "assistant", content: reply }];
  // Na 3ª e na 6ª mensagem da pessoa, atualiza o resumo emocional do dia (em segundo plano).
  if (userTurns === 3 || userTurns === 6) {
    runInBackground(updateDailyLog(ctx, transcript));
  }
  // Memória entre conversas: atualizada na 3ª, 8ª e 15ª mensagem (se a pessoa não desligou).
  if (prep.memoryEnabled && (userTurns === 3 || userTurns === 8 || userTurns === 15)) {
    runInBackground(updateMemory(ctx, prep.memory, transcript));
  }

  const tasks = crisis ? [] : await extractTasks(reply);
  return {
    chatId,
    reply,
    crisis,
    risk: prep.risk,
    mode: prep.mode,
    promptVersion: PROMPT_VERSION,
    title,
    tasks,
    userMessageId,
    assistantMessageId: botRow?.id ?? null,
  };
}

function modelMessages(prep: PreparedChat): ChatMessage[] {
  return [{ role: "system", content: prep.system }, ...prep.history, { role: "user", content: prep.message }];
}

// Conversa completa de uma vez (versões antigas do app e plano B do streaming).
async function chat(ctx: Ctx, body: Record<string, unknown>) {
  const prep = await prepareChat(ctx, body);
  let reply = "";
  try {
    reply = await groqChat(modelMessages(prep));
  } catch (e) {
    console.error(e);
  }
  return finishChat(ctx, prep, reply);
}

// Conversa com a resposta chegando aos pedaços (a pessoa vê o texto sendo escrito).
// Formato: uma linha JSON por evento (NDJSON):
//   {"type":"start","chatId","userMessageId"} → {"type":"delta","text"}… → {"type":"done", ...resultado}
// Se a pessoa tocar em "parar", o app fecha a conexão: a geração é cancelada e nada é salvo.
async function chatStream(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const prep = await prepareChat(ctx, body); // erros de limite/validação voltam como JSON normal
  const encoder = new TextEncoder();
  const upstream = new AbortController();
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch (_e) {
          cancelled = true;
        }
      };
      send({ type: "start", chatId: prep.chatId, userMessageId: prep.userMessageId, crisis: prep.crisis, risk: prep.risk, mode: prep.mode });

      let reply = "";
      try {
        reply = await groqChatStream(modelMessages(prep), (text) => send({ type: "delta", text }), { signal: upstream.signal });
      } catch (e) {
        if (!cancelled) console.error(e);
      }
      if (cancelled) return;

      // Sem resposta do modelo: manda o texto de apoio como se tivesse sido escrito.
      if (!reply) send({ type: "delta", text: prep.crisis ? CRISIS_FALLBACK : ERROR_FALLBACK });
      try {
        const result = await finishChat(ctx, prep, reply);
        send({ type: "done", ...result });
      } catch (e) {
        console.error(e);
        send({ type: "error", error: "Não foi possível salvar a resposta." });
      }
      try {
        controller.close();
      } catch (_e) {}
    },
    cancel() {
      cancelled = true;
      upstream.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

// Apagar mensagens específicas (menu da mensagem no Porto).
async function deleteMessages(ctx: Ctx, body: Record<string, unknown>) {
  const chatId = String(body.chatId ?? "");
  await assertOwnChat(ctx, chatId);
  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === "string").slice(0, 200) : [];
  if (ids.length) await ctx.db.from("messages").delete().eq("chat_id", chatId).in("id", ids);
  return { ok: true };
}

// "Parar resposta": apaga tudo o que veio depois da última mensagem que o app já conhecia.
async function deleteAfter(ctx: Ctx, body: Record<string, unknown>) {
  const chatId = String(body.chatId ?? "");
  await assertOwnChat(ctx, chatId);
  const afterId = typeof body.afterId === "string" ? body.afterId : null;
  let query = ctx.db.from("messages").delete().eq("chat_id", chatId);
  if (afterId) {
    const { data: ref } = await ctx.db.from("messages").select("created_at").eq("id", afterId).eq("chat_id", chatId).maybeSingle();
    if (!ref) return { ok: true };
    query = query.gt("created_at", ref.created_at);
  }
  await query;
  return { ok: true };
}

// Editar uma mensagem da pessoa: troca o texto e apaga o que veio depois (o app pede nova resposta com regenerate).
async function editMessage(ctx: Ctx, body: Record<string, unknown>) {
  const chatId = String(body.chatId ?? "");
  await assertOwnChat(ctx, chatId);
  const messageId = String(body.messageId ?? "");
  const content = cleanText(body.content);
  const { data: ref } = await ctx.db.from("messages").select("created_at, role").eq("id", messageId).eq("chat_id", chatId).maybeSingle();
  if (!ref || ref.role !== "user") throw new HttpError(404, "Mensagem não encontrada");
  await ctx.db.from("messages").update({ content: await encrypt(content) }).eq("id", messageId);
  await ctx.db.from("messages").delete().eq("chat_id", chatId).gt("created_at", ref.created_at);
  return { ok: true };
}

// Frase do dia na aba Logs, baseada nos hábitos marcados.
async function logInsight(_ctx: Ctx, body: Record<string, unknown>) {
  const done = Array.isArray(body.completed)
    ? body.completed.filter((t): t is string => typeof t === "string").slice(0, 30).map((t) => t.slice(0, 60))
    : [];
  const progress = Number(body.progress) || 0;
  const insight = await groqChat(
    [
      { role: "system", content: LOG_INSIGHT_PROMPT },
      { role: "user", content: `Progresso de hoje: ${Math.round(progress)}%. Hábitos feitos: ${done.join(", ") || "nenhum ainda"}.` },
    ],
    { model: FAST_MODEL, temperature: 0.8, maxTokens: 80 },
  );
  return { insight: insight.replace(/^["']|["']$/g, "") };
}

async function listChats(ctx: Ctx) {
  const { data, error } = await ctx.db
    .from("chats")
    .select("id, title, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new HttpError(500, "Não foi possível carregar o histórico");
  const chats = [];
  for (const c of data ?? []) chats.push({ id: c.id, created_at: c.created_at, title: (await decrypt(c.title)) || "Conversa" });
  return { chats };
}

async function history(ctx: Ctx, body: Record<string, unknown>) {
  const chatId = String(body.chatId ?? "");
  await assertOwnChat(ctx, chatId);
  const { data, error } = await ctx.db
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(500, "Não foi possível carregar a conversa");
  const messages = [];
  for (const m of data ?? []) messages.push({ id: m.id, role: m.role, content: await decrypt(m.content) });
  const { data: chatRow } = await ctx.db.from("chats").select("title").eq("id", chatId).maybeSingle();
  return { messages, title: (await decrypt(chatRow?.title)) || null };
}

async function deleteChat(ctx: Ctx, body: Record<string, unknown>) {
  const chatId = String(body.chatId ?? "");
  await assertOwnChat(ctx, chatId);
  await ctx.db.from("messages").delete().eq("chat_id", chatId);
  await ctx.db.from("chats").delete().eq("id", chatId).eq("user_id", ctx.userId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------

async function arena(_ctx: Ctx, body: Record<string, unknown>) {
  const scenario = cleanText(body.scenario, 120);
  const transcript = cleanTranscript(body.messages);
  const last = [...transcript].reverse().find((m) => m.role === "user");
  const crisis = last ? detectRisk(last.content) : false;
  const opening = transcript.length === 0
    ? [{ role: "user" as const, content: "Comece a conversa como o personagem, de forma natural." }]
    : [];
  const reply = await groqChat(
    [{ role: "system", content: arenaSystemPrompt(scenario, crisis) }, ...opening, ...transcript],
    { temperature: 0.8 },
  );
  return { reply: reply || "Estou pronto para o desafio. Comece você.", crisis };
}

async function arenaFeedback(ctx: Ctx, body: Record<string, unknown>) {
  const scenario = cleanText(body.scenario, 120);
  const transcript = cleanTranscript(body.messages);
  if (!transcript.some((m) => m.role === "user")) {
    throw new HttpError(400, "Converse um pouco antes de pedir o retorno.");
  }
  const text = transcript
    .map((m) => `${m.role === "user" ? "USUÁRIO" : "PERSONAGEM"}: ${m.content}`)
    .join("\n");
  const limitMessage = await consume(ctx.admin, ctx.userId, "arena_feedback");
  if (limitMessage) throw new HttpError(429, limitMessage);
  const feedback = await groqChat(
    [{ role: "system", content: arenaFeedbackPrompt(scenario) }, { role: "user", content: text }],
    { temperature: 0.4, maxTokens: 500 },
  );
  return { feedback };
}

// ---------------------------------------------------------------------
// Cofre
// ---------------------------------------------------------------------

async function vaultSave(ctx: Ctx, body: Record<string, unknown>) {
  const content = cleanText(body.content, 10000);
  const { data, error } = await ctx.db
    .from("vault_entries")
    .insert({ user_id: ctx.userId, content: await encrypt(content) })
    .select("id, created_at")
    .single();
  if (error) throw new HttpError(500, "Não foi possível guardar no Cofre");
  return { entry: { id: data.id, created_at: data.created_at, content } };
}

async function vaultList(ctx: Ctx) {
  const { data, error } = await ctx.db
    .from("vault_entries")
    .select("id, content, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new HttpError(500, "Não foi possível abrir o Cofre");
  const entries = [];
  for (const e of data ?? []) entries.push({ id: e.id, created_at: e.created_at, content: await decrypt(e.content) });
  return { entries };
}

async function vaultDelete(ctx: Ctx, body: Record<string, unknown>) {
  const id = String(body.id ?? "");
  await ctx.db.from("vault_entries").delete().eq("id", id).eq("user_id", ctx.userId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Exclusão de conta (LGPD + política do Google Play)
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Datas no fuso de Brasília
// ---------------------------------------------------------------------

const brtNow = () => new Date(Date.now() - 3 * 3600_000);
const brtDay = (d = brtNow()) => d.toISOString().slice(0, 10);
/** Segunda-feira da semana (Brasília) de um dia "AAAA-MM-DD". */
function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Início do dia (Brasília) em ISO UTC, para filtrar created_at.
const dayStartIso = (day: string) => new Date(`${day}T03:00:00Z`).toISOString();

// ---------------------------------------------------------------------
// Resumo semanal (Pro)
// ---------------------------------------------------------------------

async function weekStats(ctx: Ctx, start: string, end: string) {
  const [{ data: moods }, { data: habits }, { data: days }, { data: chats }, { data: journal }] = await Promise.all([
    ctx.db.from("mood_logs").select("mood, created_at").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).lt("created_at", dayStartIso(addDays(end, 1))),
    ctx.db.from("habit_logs").select("day, progress, completed").eq("user_id", ctx.userId).gte("day", start).lte("day", end),
    ctx.db.from("daily_logs").select("date, humor, assunto, conselho").eq("user_id", ctx.userId).gte("date", start).lte("date", end),
    ctx.db.from("chats").select("id, title, created_at").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).limit(30),
    ctx.db.from("journal_entries").select("kind, summary, mood, created_at").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).limit(14),
  ]);
  const moodCount: Record<string, number> = { calmo: 0, ansioso: 0, agitado: 0, sos: 0 };
  for (const m of moods ?? []) if (m.mood in moodCount) moodCount[m.mood]++;
  for (const d of days ?? []) if (d.humor && d.humor in moodCount && !(moods ?? []).length) moodCount[d.humor]++;
  const daysWithLogs = (habits ?? []).filter((h) => Number(h.progress) > 0).length;
  return { moodCount, daysWithLogs, days: days ?? [], chats: chats ?? [], journal: journal ?? [] };
}

async function weeklySummary(ctx: Ctx, body: Record<string, unknown>) {
  const today = brtDay();
  const weekStart = mondayOf(today);
  const info = await getPlan(ctx.admin, ctx.userId);
  const stats = await weekStats(ctx, weekStart, today);
  const publicStats = {
    moods: stats.moodCount,
    daysWithLogs: stats.daysWithLogs,
    conversations: stats.chats.length,
    journalEntries: stats.journal.length,
  };
  const hasData = Object.values(stats.moodCount).some((n) => n > 0) || stats.daysWithLogs > 0 || stats.chats.length > 0 || stats.journal.length > 0;
  if (!hasData) return { weekStart, empty: true, locked: false, summary: null, stats: publicStats };
  if (info.effective !== "pro") return { weekStart, empty: false, locked: true, summary: null, stats: publicStats };

  // No máximo um resumo novo por dia (o de domingo fecha a semana).
  const { data: existing } = await ctx.db.from("weekly_summaries").select("content, created_at")
    .eq("user_id", ctx.userId).eq("week_start", weekStart).maybeSingle();
  if (existing && body.refresh !== true && brtDay(new Date(new Date(existing.created_at).getTime() - 3 * 3600_000)) === today) {
    return { weekStart, empty: false, locked: false, summary: await decrypt(existing.content), stats: publicStats };
  }

  const titles: string[] = [];
  for (const c of stats.chats.slice(0, 12)) {
    const t = await decrypt(c.title);
    if (t && t !== "Nova conversa" && t !== "Momento difícil") titles.push(t);
  }
  const journalLines: string[] = [];
  for (const j of stats.journal.slice(0, 7)) {
    const sm = j.summary ? await decrypt(j.summary) : "";
    if (sm) journalLines.push(`${j.kind}: ${sm.slice(0, 200)}`);
  }
  const lines = [
    `Período: ${weekStart} a ${today}.`,
    `Humor marcado: ${Object.entries(stats.moodCount).filter(([, n]) => n).map(([k, n]) => `${k} ${n}x`).join(", ") || "nenhum"}.`,
    `Dias com hábitos marcados nos Logs: ${stats.daysWithLogs}.`,
    `Assuntos das conversas: ${[...new Set([...stats.days.map((d) => d.assunto).filter(Boolean), ...titles])].slice(0, 8).join("; ") || "nenhum"}.`,
    stats.days.length ? `Conselhos do dia já dados: ${stats.days.map((d) => d.conselho).filter(Boolean).slice(0, 3).join(" | ")}` : "",
    journalLines.length ? `Diário:\n${journalLines.join("\n")}` : "",
  ].filter(Boolean).join("\n");

  const name = await personName(ctx);
  let summary = "";
  try {
    summary = await groqChat(
      [{ role: "system", content: WEEKLY_PROMPT }, { role: "user", content: `${name ? `Nome: ${name}\n` : ""}${lines}` }],
      { temperature: 0.6, maxTokens: 300 },
    );
  } catch (e) {
    console.error(e);
  }
  if (!summary) throw new HttpError(503, "Não foi possível escrever seu resumo agora. Tente daqui a pouco.");
  await ctx.db.from("weekly_summaries").upsert({
    user_id: ctx.userId,
    week_start: weekStart,
    content: await encrypt(summary),
    created_at: new Date().toISOString(),
  }, { onConflict: "user_id,week_start" });
  return { weekStart, empty: false, locked: false, summary, stats: publicStats };
}

// ---------------------------------------------------------------------
// Diário (voz, gratidão, preparação de conversa, aterramento)
// ---------------------------------------------------------------------

const JOURNAL_KINDS = ["voz", "gratidao", "conversa", "aterramento", "noite"];

async function journalEntryOut(row: { id: string; kind: string; content: string; summary: string | null; mood: string | null; created_at: string }) {
  const summary = row.summary ? await decrypt(row.summary) : "";
  const content = await decrypt(row.content);
  return { id: row.id, kind: row.kind, mood: row.mood, created_at: row.created_at, summary: summary || content.slice(0, 160), content };
}

async function journalVoice(ctx: Ctx, body: Record<string, unknown>) {
  const text = cleanText(body.text, 4000);
  const keywordRisk = detectRisk(text);
  const [risk, raw] = await Promise.all([
    keywordRisk ? Promise.resolve<RiskLevel>("alto") : withTimeout(classifyRisk([], text), 2500, "nenhum" as RiskLevel),
    groqChat([{ role: "system", content: VOICE_JOURNAL_PROMPT }, { role: "user", content: text }], { model: FAST_MODEL, temperature: 0.3, maxTokens: 300 })
      .catch(() => ""),
  ]);
  const parsed = parseJsonObject(raw) ?? {};
  const crisis = risk === "alto";
  let mood = typeof parsed.humor === "string" && VALID_MOODS.includes(parsed.humor) ? parsed.humor : null;
  if (crisis) mood = "sos";
  const titulo = typeof parsed.titulo === "string" ? parsed.titulo.slice(0, 60) : "Diário do dia";
  const resumo = typeof parsed.resumo === "string" && parsed.resumo.trim() ? parsed.resumo.trim().slice(0, 400) : text.slice(0, 200);
  const passos = crisis || !Array.isArray(parsed.passos) ? [] : (parsed.passos as unknown[])
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().slice(0, 60)).slice(0, 2);

  const { data: row, error } = await ctx.db.from("journal_entries").insert({
    user_id: ctx.userId,
    kind: "voz",
    content: await encrypt(text),
    summary: await encrypt(resumo),
    mood,
  }).select("id, kind, content, summary, mood, created_at").single();
  if (error || !row) throw new HttpError(500, "Não foi possível salvar seu diário agora");

  if (mood) await ctx.db.from("mood_logs").insert({ user_id: ctx.userId, mood });
  // Se o Porto ainda não resumiu o dia, o diário vira o resumo de hoje (lido pelo Farol).
  const today = brtDay();
  const { data: daily } = await ctx.db.from("daily_logs").select("date").eq("user_id", ctx.userId).eq("date", today).maybeSingle();
  if (!daily && mood) {
    await ctx.db.from("daily_logs").upsert({ user_id: ctx.userId, date: today, humor: mood, assunto: titulo.split(" ").slice(0, 3).join(" "), conselho: null }, { onConflict: "user_id,date" });
  }
  return { entry: { ...(await journalEntryOut(row)), title: titulo }, crisis, risk, tasks: passos };
}

async function journalSave(ctx: Ctx, body: Record<string, unknown>) {
  const kind = String(body.kind ?? "");
  if (!JOURNAL_KINDS.includes(kind) || kind === "voz") throw new HttpError(400, "Tipo inválido");
  const content = cleanText(body.content, 4000);
  const summary = typeof body.summary === "string" ? body.summary.slice(0, 400) : null;
  const { data: row, error } = await ctx.db.from("journal_entries").insert({
    user_id: ctx.userId,
    kind,
    content: await encrypt(content),
    summary: summary ? await encrypt(summary) : null,
  }).select("id, kind, content, summary, mood, created_at").single();
  if (error || !row) throw new HttpError(500, "Não foi possível salvar agora");
  return { entry: await journalEntryOut(row), crisis: detectRisk(content) };
}

async function journalList(ctx: Ctx, body: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
  let query = ctx.db.from("journal_entries").select("id, kind, content, summary, mood, created_at")
    .eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(limit);
  if (typeof body.kind === "string" && JOURNAL_KINDS.includes(body.kind)) query = query.eq("kind", body.kind);
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Não foi possível carregar o diário");
  const entries = [];
  for (const r of data ?? []) entries.push(await journalEntryOut(r));
  return { entries };
}

async function journalDelete(ctx: Ctx, body: Record<string, unknown>) {
  await ctx.db.from("journal_entries").delete().eq("id", String(body.id ?? "")).eq("user_id", ctx.userId);
  return { ok: true };
}

async function prepConversation(_ctx: Ctx, body: Record<string, unknown>) {
  const pessoa = cleanText(body.pessoa, 60);
  const parts = ["objetivo", "sentimento", "pedido"].map((k) => (typeof body[k] === "string" ? String(body[k]).slice(0, 400) : ""));
  const crisis = detectRisk(parts.join(" "));
  const raw = await groqChat(
    [
      { role: "system", content: CONVERSATION_PREP_PROMPT },
      { role: "user", content: `Com quem: ${pessoa}\nO que aconteceu / o que quero dizer: ${parts[0]}\nComo me sinto: ${parts[1]}\nO que vou pedir: ${parts[2]}` },
    ],
    { temperature: 0.6, maxTokens: 300 },
  ).catch(() => "");
  const parsed = parseJsonObject(raw) ?? {};
  const aberturas = Array.isArray(parsed.aberturas)
    ? (parsed.aberturas as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.trim().slice(0, 240)).slice(0, 2)
    : [];
  const dica = typeof parsed.dica === "string" ? parsed.dica.slice(0, 200) : "Respire antes de responder e fale do que você sente, não do que o outro é.";
  return {
    aberturas: aberturas.length ? aberturas : [`${pessoa}, posso conversar com você sobre uma coisa que tem me incomodado?`],
    dica,
    crisis,
    cenario: `Conversa difícil com ${pessoa}`.slice(0, 120),
  };
}

// ---------------------------------------------------------------------
// Conquistas da jornada (calculadas a partir dos registros; nada novo é guardado)
// ---------------------------------------------------------------------

function longestRun(days: string[]): { best: number; current: number } {
  const set = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of set) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const today = brtDay();
  let current = 0;
  const has = new Set(set);
  let cursor = has.has(today) ? today : addDays(today, -1);
  while (has.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  return { best, current };
}

async function achievements(ctx: Ctx) {
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = ctx.db.from(table).select("*", { count: "exact", head: true }).eq("user_id", ctx.userId);
    if (filter) q = filter(q);
    const { count: n } = await q;
    return n ?? 0;
  };
  const [{ data: moods }, { data: habits }, chats, voice, gratidao, conversa, aterramento, noite, arena, plan, weeks] = await Promise.all([
    ctx.db.from("mood_logs").select("created_at").eq("user_id", ctx.userId).limit(2000),
    ctx.db.from("habit_logs").select("day, progress").eq("user_id", ctx.userId).limit(2000),
    count("chats"),
    count("journal_entries", (q) => q.eq("kind", "voz")),
    count("journal_entries", (q) => q.eq("kind", "gratidao")),
    count("journal_entries", (q) => q.eq("kind", "conversa")),
    count("journal_entries", (q) => q.eq("kind", "aterramento")),
    count("journal_entries", (q) => q.eq("kind", "noite")),
    ctx.admin.from("usage_events").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("kind", "arena_feedback").then((r) => r.count ?? 0),
    count("safety_plans"),
    count("weekly_summaries"),
  ]);
  const moodDays = [...new Set((moods ?? []).map((m) => brtDay(new Date(new Date(m.created_at).getTime() - 3 * 3600_000))))];
  const habitDays = (habits ?? []).filter((h) => Number(h.progress) > 0).map((h) => h.day as string);
  const careDays = [...new Set([...moodDays, ...habitDays])];
  const streak = longestRun(careDays);
  return {
    stats: {
      moodCount: (moods ?? []).length,
      moodDays: moodDays.length,
      habitDays: habitDays.length,
      careDays: careDays.length,
      bestStreak: streak.best,
      currentStreak: streak.current,
      chats,
      voice,
      gratidao,
      conversa,
      aterramento,
      noite,
      arena,
      plan: plan > 0 ? 1 : 0,
      weeks,
    },
  };
}

// ---------------------------------------------------------------------
// Relatório mensal (Pro) — dados para o PDF que a pessoa leva ao psicólogo
// ---------------------------------------------------------------------

async function monthlyReport(ctx: Ctx, body: Record<string, unknown>) {
  const info = await getPlan(ctx.admin, ctx.userId);
  if (info.effective !== "pro") throw new HttpError(402, "O relatório mensal faz parte do Nórica Pro");
  const today = brtDay();
  const start = addDays(today, -29);
  const [{ data: moods }, { data: habits }, { data: days }, { data: chats }, { data: journal }] = await Promise.all([
    ctx.db.from("mood_logs").select("mood, created_at").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).order("created_at", { ascending: true }),
    ctx.db.from("habit_logs").select("day, progress, completed").eq("user_id", ctx.userId).gte("day", start),
    ctx.db.from("daily_logs").select("date, humor, assunto").eq("user_id", ctx.userId).gte("date", start),
    ctx.db.from("chats").select("title").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).limit(40),
    ctx.db.from("journal_entries").select("kind, summary, mood, created_at").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).limit(30),
  ]);

  // Humor por dia (o último marcado vence; sem marcação, vale o resumo do Porto).
  const byDay: Record<string, string> = {};
  for (const d of days ?? []) if (d.humor) byDay[d.date] = d.humor;
  for (const m of moods ?? []) byDay[brtDay(new Date(new Date(m.created_at).getTime() - 3 * 3600_000))] = m.mood;
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(start, i);
    return { day, mood: byDay[day] ?? null };
  });
  const moodCount: Record<string, number> = { calmo: 0, ansioso: 0, agitado: 0, sos: 0 };
  for (const p of series) if (p.mood && p.mood in moodCount) moodCount[p.mood]++;
  const habitFreq: Record<string, number> = {};
  for (const h of habits ?? []) for (const id of (h.completed ?? []) as number[]) habitFreq[id] = (habitFreq[id] ?? 0) + 1;
  const habitDays = (habits ?? []).filter((h) => Number(h.progress) > 0).length;
  const topics: string[] = [];
  for (const d of days ?? []) if (d.assunto) topics.push(String(d.assunto).toLowerCase());
  for (const c of chats ?? []) {
    const t = await decrypt(c.title);
    if (t && t !== "Nova conversa" && t !== "Momento difícil") topics.push(t.toLowerCase());
  }
  const topicCount = new Map<string, number>();
  for (const t of topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  const topTopics = [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  const journalLines: string[] = [];
  for (const j of (journal ?? []).slice(0, 12)) {
    const sm = j.summary ? await decrypt(j.summary) : "";
    if (sm) journalLines.push(`${j.created_at.slice(0, 10)} (${j.kind}): ${sm.slice(0, 160)}`);
  }

  const month = `${today.slice(0, 7)}-01`;
  let letter = "";
  const { data: cached } = await ctx.db.from("monthly_reports").select("content, created_at").eq("user_id", ctx.userId).eq("month", month).maybeSingle();
  if (cached && body.refresh !== true && brtDay(new Date(new Date(cached.created_at).getTime() - 3 * 3600_000)) === today) {
    letter = await decrypt(cached.content);
  } else {
    const facts = [
      `Período: ${start} a ${today}.`,
      `Dias por humor: ${Object.entries(moodCount).map(([k, n]) => `${k} ${n}`).join(", ")}; dias sem registro: ${series.filter((p) => !p.mood).length}.`,
      `Primeira quinzena: ${series.slice(0, 15).map((p) => p.mood ?? "-").join(" ")}`,
      `Segunda quinzena: ${series.slice(15).map((p) => p.mood ?? "-").join(" ")}`,
      `Dias com hábitos marcados: ${habitDays}.`,
      `Assuntos: ${topTopics.join("; ") || "nenhum"}.`,
      journalLines.length ? `Diário:\n${journalLines.join("\n")}` : "",
    ].filter(Boolean).join("\n");
    try {
      letter = await groqChat([{ role: "system", content: MONTHLY_PROMPT }, { role: "user", content: facts }], { temperature: 0.4, maxTokens: 500 });
    } catch (e) {
      console.error(e);
    }
    if (letter) {
      await ctx.db.from("monthly_reports").upsert({ user_id: ctx.userId, month, content: await encrypt(letter), created_at: new Date().toISOString() }, { onConflict: "user_id,month" });
    }
  }
  return {
    name: await personName(ctx),
    start,
    end: today,
    series,
    moodCount,
    habitDays,
    habitFreq,
    topics: topTopics,
    journalCount: (journal ?? []).length,
    conversations: (chats ?? []).length,
    letter: letter || null,
  };
}

// ---------------------------------------------------------------------
// Parceiros (B2B): instituição e painel com números agregados e anônimos
// ---------------------------------------------------------------------

const MIN_GROUP = 5; // abaixo disso, nenhum número é mostrado (evita identificar alguém)

type Membership = { orgId: string; name: string; role: string; sectorId: string | null; sectorLabel: string };

async function myMembership(ctx: Ctx, role?: "admin"): Promise<Membership | null> {
  let query = ctx.admin.from("org_members").select("org_id, role, sector_id").eq("user_id", ctx.userId);
  if (role) query = query.eq("role", role);
  const { data: rows } = await query.order("role", { ascending: true }).limit(1);
  const m = rows?.[0];
  if (!m) return null;
  const { data: org } = await ctx.admin.from("organizations").select("id, name, sector_label").eq("id", m.org_id).maybeSingle();
  return org
    ? { orgId: org.id as string, name: org.name as string, role: m.role as string, sectorId: (m.sector_id as string) ?? null, sectorLabel: (org.sector_label as string) || "Setor" }
    : null;
}

async function sectorsOf(ctx: Ctx, orgId: string) {
  const { data } = await ctx.admin.from("org_sectors").select("id, name").eq("org_id", orgId).order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string }[];
}

async function orgOut(ctx: Ctx, m: Membership | null) {
  if (!m) return { org: null };
  return { org: { name: m.name, role: m.role, sectorId: m.sectorId, sectorLabel: m.sectorLabel, sectors: await sectorsOf(ctx, m.orgId) } };
}

async function orgStatus(ctx: Ctx) {
  return orgOut(ctx, await myMembership(ctx));
}

async function orgJoin(ctx: Ctx, body: Record<string, unknown>) {
  const code = String(body.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4) throw new HttpError(400, "Digite o código que a instituição passou para você");
  const { data: org } = await ctx.admin.from("organizations").select("id, name, demo").eq("code", code).maybeSingle();
  if (!org) throw new HttpError(404, "Código não encontrado. Confira com a sua instituição.");
  await ctx.admin.from("org_members").delete().eq("user_id", ctx.userId).neq("org_id", org.id).eq("role", "member");
  await leaveDemos(ctx, org.id as string);
  // Demonstração: quem entra vê o painel como a equipe (com números fictícios).
  const { error } = await ctx.admin.from("org_members").upsert(
    { org_id: org.id, user_id: ctx.userId, ...(org.demo ? { role: "admin" } : {}) },
    { onConflict: "org_id,user_id", ignoreDuplicates: !org.demo },
  );
  if (error) throw new HttpError(500, "Não foi possível entrar agora");
  return orgOut(ctx, await myMembership(ctx));
}

async function orgSetSector(ctx: Ctx, body: Record<string, unknown>) {
  const m = await myMembership(ctx);
  if (!m) throw new HttpError(404, "Você não faz parte de uma instituição");
  const sectorId = typeof body.sectorId === "string" && body.sectorId ? body.sectorId : null;
  if (sectorId) {
    const { data: sec } = await ctx.admin.from("org_sectors").select("id").eq("id", sectorId).eq("org_id", m.orgId).maybeSingle();
    if (!sec) throw new HttpError(404, "Setor não encontrado");
  }
  await ctx.admin.from("org_members").update({ sector_id: sectorId }).eq("org_id", m.orgId).eq("user_id", ctx.userId);
  return orgOut(ctx, await myMembership(ctx));
}

async function leaveDemos(ctx: Ctx, exceptOrgId?: string) {
  const { data: demos } = await ctx.admin.from("organizations").select("id").eq("demo", true);
  const ids = (demos ?? []).map((d) => d.id as string).filter((id) => id !== exceptOrgId);
  if (ids.length) await ctx.admin.from("org_members").delete().eq("user_id", ctx.userId).in("org_id", ids);
}

async function orgLeave(ctx: Ctx) {
  await ctx.admin.from("org_members").delete().eq("user_id", ctx.userId).eq("role", "member");
  await leaveDemos(ctx);
  return { ok: true };
}

async function orgSectorCreate(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me) throw new HttpError(403, "Só a equipe da instituição pode criar setores");
  const name = cleanText(body.name, 40);
  const { error } = await ctx.admin.from("org_sectors").insert({ org_id: me.orgId, name });
  if (error) throw new HttpError(409, "Já existe um setor com esse nome");
  return { sectors: await sectorsOf(ctx, me.orgId) };
}

async function orgSectorDelete(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me) throw new HttpError(403, "Só a equipe da instituição pode remover setores");
  await ctx.admin.from("org_members").update({ sector_id: null }).eq("org_id", me.orgId).eq("sector_id", String(body.id ?? ""));
  await ctx.admin.from("org_sectors").delete().eq("org_id", me.orgId).eq("id", String(body.id ?? ""));
  return { sectors: await sectorsOf(ctx, me.orgId) };
}

// ---------------------------------------------------------------------
// Voz natural (leitura em voz alta das respostas)
// ---------------------------------------------------------------------

async function ttsInfo() {
  return { available: ttsConfigured(), voices: Object.entries(TTS_VOICES).map(([id, v]) => ({ id, label: v.label })) };
}

async function tts(ctx: Ctx, body: Record<string, unknown>) {
  if (!ttsConfigured()) throw new HttpError(503, "Voz natural indisponível");
  const text = cleanText(body.text, 1800);
  const limited = await consume(ctx.admin, ctx.userId, "tts");
  if (limited) throw new HttpError(429, limited);
  try {
    return await synthesize(text, String(body.voice ?? "serena"));
  } catch (e) {
    console.error(e);
    throw new HttpError(502, "A voz natural não respondeu agora");
  }
}

const SECTOR_LABELS = ["Setor", "Turma", "Equipe", "Departamento", "Unidade"];
async function orgSetLabel(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me) throw new HttpError(403, "Só a equipe da instituição pode mudar isso");
  const label = String(body.label ?? "");
  if (!SECTOR_LABELS.includes(label)) throw new HttpError(400, "Nome de grupo inválido");
  await ctx.admin.from("organizations").update({ sector_label: label }).eq("id", me.orgId);
  return { sectorLabel: label };
}

type Week = { active: Set<string>; marks: Record<string, number>; hardPeople: Set<string>; logPeople: Set<string>; topics: Map<string, Set<string>> };
const newWeek = (): Week => ({ active: new Set(), marks: { calmo: 0, ansioso: 0, agitado: 0, sos: 0 }, hardPeople: new Set(), logPeople: new Set(), topics: new Map() });
const pct = (n: number, total: number) => (total ? Math.round((100 * n) / total) : 0);

function describeWeek(w: Week) {
  const total = Object.values(w.marks).reduce((a, b) => a + b, 0);
  if (w.active.size < MIN_GROUP) return null;
  return {
    active: w.active.size,
    moodPct: Object.fromEntries(Object.entries(w.marks).map(([k, n]) => [k, pct(n, total)])),
    hardPeoplePct: pct(w.hardPeople.size, w.active.size),
    logsPct: pct(w.logPeople.size, w.active.size),
    topics: [...w.topics.entries()]
      .filter(([, people]) => people.size >= 3) // tema só aparece se 3+ pessoas falaram dele
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5)
      .map(([topic, people]) => ({ topic, pct: pct(people.size, w.active.size) })),
  };
}

/** Junta pessoas de um subconjunto numa semana (para calcular um setor). */
function subsetWeek(w: Week, people: Set<string>): Week {
  const out = newWeek();
  for (const u of w.active) if (people.has(u)) out.active.add(u);
  for (const u of w.hardPeople) if (people.has(u)) out.hardPeople.add(u);
  for (const u of w.logPeople) if (people.has(u)) out.logPeople.add(u);
  for (const [t, ps] of w.topics) {
    const f = new Set([...ps].filter((u) => people.has(u)));
    if (f.size) out.topics.set(t, f);
  }
  return out;
}

// ---------------------------------------------------------------------
// Instituição de demonstração (para apresentar a escolas e empresas).
// organizations.demo = true → quem entra com o código vira equipe e vê números fictícios.
// ---------------------------------------------------------------------

function seeded(seed: number) {
  let x = seed % 2147483647 || 1;
  return () => (x = (x * 48271) % 2147483647) / 2147483647;
}

function demoWeek(rnd: () => number, active: number, stress: number, topics: string[]): WeekOut {
  const sos = Math.round(rnd() * 3 * stress);
  const ansioso = Math.round(18 + 30 * stress + rnd() * 8);
  const agitado = Math.round(8 + 14 * stress + rnd() * 6);
  const calmo = Math.max(5, 100 - ansioso - agitado - sos);
  return {
    active,
    moodPct: { calmo, ansioso, agitado, sos },
    hardPeoplePct: Math.min(95, Math.round(25 + 55 * stress + rnd() * 6)),
    logsPct: Math.round(35 + rnd() * 30),
    topics: topics.slice(0, 3).map((topic, i) => ({ topic, pct: Math.round(45 - i * 12 + rnd() * 6) })),
  };
}

function demoDashboard(me: Membership, sectorList: { id: string; name: string }[]) {
  const week = Math.floor(Date.now() / (7 * 86400_000));
  const rnd = seeded(week * 7919);
  const school = me.sectorLabel === "Turma";
  const topicsPool = school ? ["provas", "vestibular", "sono", "família", "amizades"] : ["metas", "prazos", "liderança", "sono", "família"];
  const names = sectorList.length ? sectorList : (school ? ["1º ano", "2º ano", "3º ano", "Cursinho"] : ["Vendas", "RH", "Tecnologia", "Operações"]).map((name, i) => ({ id: `demo-${i}`, name }));
  const sectors: SectorRowOut[] = names.map((sec, i) => {
    const stress = i === 0 ? 0.75 : 0.25 + rnd() * 0.35; // o primeiro grupo aparece mais pressionado
    const members = 18 + Math.round(rnd() * 25);
    const active = Math.round(members * (0.6 + rnd() * 0.25));
    const topics = [...topicsPool].sort(() => rnd() - 0.5);
    return { id: sec.id, name: sec.name, members, current: demoWeek(rnd, active, stress, topics), previous: demoWeek(rnd, active - 2, Math.max(0.1, stress - (i === 0 ? 0.25 : 0.05)), topics) };
  });
  const members = sectors.reduce((a, r) => a + r.members, 0);
  const active = sectors.reduce((a, r) => a + (r.current?.active ?? 0), 0);
  const current = demoWeek(rnd, active, 0.45, topicsPool);
  const previous = demoWeek(rnd, active - 6, 0.38, topicsPool);
  const { alerts, actions } = groupInsights(current, previous, sectors);
  return {
    org: me.name,
    sectorLabel: me.sectorLabel,
    members,
    minGroup: MIN_GROUP,
    current,
    previous,
    sectors,
    sectorList,
    alerts,
    actions,
    demo: true,
    weeks: [0.3, 0.36, 0.38, 0.45].map((st, i) => ({ label: i === 3 ? "Esta semana" : `${3 - i} sem. atrás`, active: active - (3 - i) * 4, hardPeoplePct: Math.round(25 + 55 * st) })),
  };
}

type WeekOut = NonNullable<ReturnType<typeof describeWeek>>;
type SectorRowOut = { id: string; name: string; members: number; current: WeekOut | null; previous: WeekOut | null };

function groupInsights(current: WeekOut | null, previous: WeekOut | null, sectorRows: SectorRowOut[]) {
  // Sinais de atenção e ações sugeridas (sempre sobre o grupo, nunca sobre pessoas).
  const alerts: string[] = [];
  for (const r of sectorRows) {
    if (r.current && r.previous && r.current.hardPeoplePct - r.previous.hardPeoplePct >= 10) {
      alerts.push(`${r.name}: dias difíceis subiram de ${r.previous.hardPeoplePct}% para ${r.current.hardPeoplePct}% das pessoas.`);
    }
    if (r.current && current && r.current.hardPeoplePct - current.hardPeoplePct >= 15) {
      alerts.push(`${r.name} está ${r.current.hardPeoplePct - current.hardPeoplePct} pontos acima da média em dias difíceis.`);
    }
  }
  if (current && previous && current.hardPeoplePct - previous.hardPeoplePct >= 10) {
    alerts.unshift(`No geral, dias difíceis subiram de ${previous.hardPeoplePct}% para ${current.hardPeoplePct}% das pessoas.`);
  }
  const actions: string[] = [];
  if (current) {
    if (current.hardPeoplePct >= 50) actions.push("Abrir um momento de escuta (roda de conversa ou plantão) nesta semana.");
    if ((current.moodPct.ansioso ?? 0) >= 35) actions.push("Rever prazos e entregas concentrados; ansiedade alta costuma acompanhar picos de demanda.");
    if ((current.moodPct.sos ?? 0) > 0) actions.push("Divulgar de novo os canais de ajuda: CVV 188 (24h, gratuito) e o apoio psicológico da instituição.");
    if (current.logsPct < 30) actions.push("Incentivar pausas curtas de autocuidado (água, alongamento, 5 minutos longe das telas).");
    if (current.topics.some((t) => /prova|vestibular|enem|simulado/.test(t.topic))) actions.push("Semana de provas: reforçar técnicas de estudo e de respiração antes das avaliações.");
    if (!actions.length) actions.push("O grupo está estável. Mantenha os canais de escuta abertos e celebre o cuidado coletivo.");
  }

  return { alerts, actions };
}

async function orgDashboard(ctx: Ctx) {
  const me = await myMembership(ctx, "admin");
  if (!me) throw new HttpError(403, "Painel disponível só para a equipe da instituição");
  const { data: orgRow } = await ctx.admin.from("organizations").select("demo").eq("id", me.orgId).maybeSingle();
  if (orgRow?.demo) return demoDashboard(me, await sectorsOf(ctx, me.orgId));
  const { data: members } = await ctx.admin.from("org_members").select("user_id, role, sector_id").eq("org_id", me.orgId);
  const people = (members ?? []).filter((m) => m.role === "member");
  const ids = people.map((m) => m.user_id as string);
  const sectors = await sectorsOf(ctx, me.orgId);

  const today = brtDay();
  const since = addDays(today, -27); // 4 semanas
  const [{ data: moods }, { data: habits }, { data: days }] = ids.length
    ? await Promise.all([
      ctx.admin.from("mood_logs").select("user_id, mood, created_at").in("user_id", ids).gte("created_at", dayStartIso(since)),
      ctx.admin.from("habit_logs").select("user_id, day, progress").in("user_id", ids).gte("day", since),
      ctx.admin.from("daily_logs").select("user_id, date, humor, assunto").in("user_id", ids).gte("date", since),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const dayOf = (iso: string) => brtDay(new Date(new Date(iso).getTime() - 3 * 3600_000));
  const weekIndex = (day: string) => Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / (7 * 86400_000));
  const weeks: Week[] = Array.from({ length: 4 }, newWeek);
  for (const m of moods ?? []) {
    const w = weeks[weekIndex(dayOf(m.created_at))];
    if (!w) continue;
    w.active.add(m.user_id);
    if (m.mood in w.marks) w.marks[m.mood]++;
    if (m.mood !== "calmo") w.hardPeople.add(m.user_id);
  }
  for (const h of habits ?? []) {
    const w = weeks[weekIndex(h.day)];
    if (!w || !(Number(h.progress) > 0)) continue;
    w.active.add(h.user_id);
    w.logPeople.add(h.user_id);
  }
  for (const d of days ?? []) {
    const w = weeks[weekIndex(d.date)];
    if (!w) continue;
    w.active.add(d.user_id);
    if (d.humor && d.humor !== "calmo") w.hardPeople.add(d.user_id);
    const topic = typeof d.assunto === "string" ? d.assunto.toLowerCase().trim() : "";
    if (topic) {
      if (!w.topics.has(topic)) w.topics.set(topic, new Set());
      w.topics.get(topic)!.add(d.user_id);
    }
  }
  // Humor por pessoa (marcações) para dividir entre setores.
  const marksByUser = new Map<string, Record<string, number>[]>();
  for (const m of moods ?? []) {
    const wi = weekIndex(dayOf(m.created_at));
    if (wi < 0 || wi > 3) continue;
    if (!marksByUser.has(m.user_id)) marksByUser.set(m.user_id, Array.from({ length: 4 }, () => ({ calmo: 0, ansioso: 0, agitado: 0, sos: 0 })));
    marksByUser.get(m.user_id)![wi][m.mood] = (marksByUser.get(m.user_id)![wi][m.mood] ?? 0) + 1;
  }
  const weekFor = (wi: number, group: Set<string>) => {
    const w = subsetWeek(weeks[wi], group);
    for (const u of group) {
      const mk = marksByUser.get(u)?.[wi];
      if (mk) for (const k of Object.keys(w.marks)) w.marks[k] += mk[k] ?? 0;
    }
    return w;
  };

  // Setores: só aparecem com 5+ pessoas ativas na semana. Os pequenos (e quem não escolheu setor)
  // viram "Outros". Se "Outros" ficar entre 1 e 4 pessoas, o menor setor visível entra junto,
  // para que ninguém seja descoberto por subtração (total − setores).
  const groups = sectors.map((sec) => ({ id: sec.id, name: sec.name, people: new Set(people.filter((p) => p.sector_id === sec.id).map((p) => p.user_id as string)) }));
  const noSector = new Set(people.filter((p) => !p.sector_id || !sectors.some((s) => s.id === p.sector_id)).map((p) => p.user_id as string));
  const activeNow = (g: Set<string>) => [...g].filter((u) => weeks[0].active.has(u)).length;
  let shown = groups.filter((g) => activeNow(g.people) >= MIN_GROUP).sort((a, b) => activeNow(a.people) - activeNow(b.people));
  const hidden = new Set<string>([...noSector, ...groups.filter((g) => !shown.includes(g)).flatMap((g) => [...g.people])]);
  while (shown.length && activeNow(hidden) > 0 && activeNow(hidden) < MIN_GROUP) {
    const smallest = shown.shift()!;
    for (const u of smallest.people) hidden.add(u);
  }
  const sectorRows = [
    ...shown.sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({
      id: g.id,
      name: g.name,
      members: g.people.size,
      current: describeWeek(weekFor(0, g.people)),
      previous: describeWeek(weekFor(1, g.people)),
    })),
    ...(sectors.length && activeNow(hidden) >= MIN_GROUP
      ? [{ id: "outros", name: "Outros", members: hidden.size, current: describeWeek(weekFor(0, hidden)), previous: describeWeek(weekFor(1, hidden)) }]
      : []),
  ];

  const current = describeWeek(weeks[0]);
  const previous = describeWeek(weeks[1]);

  const { alerts, actions } = groupInsights(current, previous, sectorRows);

  return {
    org: me.name,
    sectorLabel: me.sectorLabel,
    members: ids.length,
    minGroup: MIN_GROUP,
    current,
    previous,
    sectors: sectorRows,
    sectorList: sectors,
    alerts,
    actions,
    weeks: weeks.map((w, i) => {
      const d = describeWeek(w);
      return { label: i === 0 ? "Esta semana" : `${i} sem. atrás`, active: d ? d.active : null, hardPeoplePct: d ? d.hardPeoplePct : null };
    }).reverse(),
  };
}

// ---------------------------------------------------------------------
// Memória da Nórica (a pessoa vê, desliga e apaga no Perfil)
// ---------------------------------------------------------------------

async function memoryGet(ctx: Ctx) {
  const { data } = await ctx.db.from("user_memory").select("content, enabled, updated_at").eq("user_id", ctx.userId).maybeSingle();
  const content = data ? await decrypt(data.content) : "";
  return {
    enabled: data ? data.enabled !== false : true,
    items: content.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean),
    updatedAt: data?.updated_at ?? null,
  };
}

async function memorySet(ctx: Ctx, body: Record<string, unknown>) {
  const enabled = body.enabled !== false;
  const { data } = await ctx.db.from("user_memory").select("user_id").eq("user_id", ctx.userId).maybeSingle();
  if (data) await ctx.db.from("user_memory").update({ enabled, updated_at: new Date().toISOString() }).eq("user_id", ctx.userId);
  else await ctx.db.from("user_memory").insert({ user_id: ctx.userId, content: await encrypt(""), enabled });
  return { ok: true, enabled };
}

async function memoryClear(ctx: Ctx) {
  await ctx.db.from("user_memory").update({ content: await encrypt(""), updated_at: new Date().toISOString() }).eq("user_id", ctx.userId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Plano de segurança (criptografado)
// ---------------------------------------------------------------------

type SafetyPlan = {
  sinais: string;
  acalma: string;
  distrair: string;
  contatos: { nome: string; telefone: string }[];
  profissionais: string;
  motivos: string;
};

function cleanPlan(raw: unknown): SafetyPlan {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 1500) : "");
  const contatos = Array.isArray(p.contatos)
    ? p.contatos
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        nome: text((c as Record<string, unknown>).nome).slice(0, 60),
        telefone: text((c as Record<string, unknown>).telefone).replace(/[^\d+]/g, "").slice(0, 20),
      }))
      .filter((c) => c.nome || c.telefone)
      .slice(0, 3)
    : [];
  return {
    sinais: text(p.sinais),
    acalma: text(p.acalma),
    distrair: text(p.distrair),
    contatos,
    profissionais: text(p.profissionais),
    motivos: text(p.motivos),
  };
}

async function safetyPlanGet(ctx: Ctx) {
  const { data } = await ctx.db.from("safety_plans").select("content, updated_at").eq("user_id", ctx.userId).maybeSingle();
  if (!data) return { plan: null, updatedAt: null };
  try {
    return { plan: cleanPlan(JSON.parse(await decrypt(data.content))), updatedAt: data.updated_at };
  } catch (_e) {
    return { plan: null, updatedAt: null };
  }
}

async function safetyPlanSave(ctx: Ctx, body: Record<string, unknown>) {
  const plan = cleanPlan(body.plan);
  const { error } = await ctx.db.from("safety_plans").upsert({
    user_id: ctx.userId,
    content: await encrypt(JSON.stringify(plan)),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "Não foi possível salvar o plano agora");
  return { ok: true, plan };
}

async function deleteAccount(ctx: Ctx) {
  const admin = ctx.admin;
  const uid = ctx.userId;
  const { data: chats } = await admin.from("chats").select("id").eq("user_id", uid);
  const chatIds = (chats ?? []).map((c) => c.id);
  if (chatIds.length) await admin.from("messages").delete().in("chat_id", chatIds);
  await admin.from("chats").delete().eq("user_id", uid);
  for (const table of ["mood_logs", "habit_logs", "daily_logs", "vault_entries", "consents", "usage_events", "user_plans", "user_memory", "safety_plans", "message_feedback", "app_errors", "weekly_summaries", "journal_entries", "org_members", "monthly_reports"]) {
    await admin.from(table).delete().eq("user_id", uid);
  }
  await admin.from("profiles").delete().eq("id", uid);
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) throw new HttpError(500, "Não foi possível excluir a conta. Tente de novo.");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------

async function plan(ctx: Ctx) {
  const info = await getPlan(ctx.admin, ctx.userId);
  const limits = PLAN_LIMITS;
  const usage = {
    porto_message: await usageToday(ctx.admin, ctx.userId, "porto_message"),
    arena_feedback: await usageToday(ctx.admin, ctx.userId, "arena_feedback"),
  };
  return { ...info, limits, usage };
}

async function proInterest(ctx: Ctx) {
  const { error } = await ctx.admin
    .from("user_plans")
    .upsert({ user_id: ctx.userId, pro_interest_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "Não foi possível registrar agora");
  return { ok: true };
}

// Assinatura Pro pela Google Play: o app manda o token da compra, o servidor confere com o Google.
async function verifyPurchase(ctx: Ctx, body: Record<string, unknown>) {
  const purchaseToken = typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : "";
  if (!purchaseToken) throw new HttpError(400, "Compra inválida");

  let sub;
  try {
    sub = await checkSubscription(purchaseToken);
  } catch (e) {
    console.error(e);
    throw new HttpError(502, "Não foi possível confirmar a compra com a Google Play. Tente de novo em instantes.");
  }
  if (sub.productId !== PRO_PRODUCT_ID) throw new HttpError(400, "Produto desconhecido");
  if (sub.accountId && sub.accountId !== ctx.userId) throw new HttpError(403, "Esta assinatura pertence a outra conta");

  // Um mesmo token não pode liberar o Pro para duas contas.
  const { data: other } = await ctx.admin
    .from("user_plans")
    .select("user_id")
    .eq("purchase_token", purchaseToken)
    .neq("user_id", ctx.userId)
    .maybeSingle();
  if (other) throw new HttpError(409, "Esta assinatura já está vinculada a outra conta");

  const { error } = await ctx.admin.from("user_plans").upsert({
    user_id: ctx.userId,
    plan: sub.active ? "pro" : "free",
    pro_until: sub.expiresAt,
    purchase_token: purchaseToken,
    store: "google_play",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "Não foi possível ativar o Pro agora");

  return { active: sub.active, proUntil: sub.expiresAt, state: sub.state };
}

// ---------------------------------------------------------------------
// Diagnóstico: confere se tudo está configurado (rode pelo app ou pelo painel do Supabase)
// ---------------------------------------------------------------------

async function health(ctx: Ctx) {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const sample = "teste Nórica";
    checks.criptografia = { ok: (await decrypt(await encrypt(sample))) === sample };
  } catch (e) {
    checks.criptografia = { ok: false, detail: String((e as Error).message) };
  }

  for (const table of ["chats", "messages", "mood_logs", "habit_logs", "daily_logs", "vault_entries", "consents", "user_plans", "usage_events", "app_errors", "user_memory", "safety_plans", "message_feedback", "weekly_summaries", "journal_entries", "organizations", "org_members", "org_sectors", "monthly_reports"]) {
    const { error } = await ctx.admin.from(table).select("*", { count: "exact", head: true });
    checks[`tabela_${table}`] = error ? { ok: false, detail: error.message } : { ok: true };
  }

  for (const [label, model] of [["ia_chat", CHAT_MODEL], ["ia_rapida", FAST_MODEL]] as const) {
    try {
      const out = await groqChat([{ role: "user", content: "Responda apenas: ok" }], { model, maxTokens: 20 });
      checks[label] = { ok: out.length > 0, detail: `${model}: ${out.slice(0, 40)}` };
    } catch (e) {
      checks[label] = { ok: false, detail: `${model}: ${String((e as Error).message).slice(0, 200)}` };
    }
  }

  return {
    ok: Object.values(checks).every((c) => c.ok),
    checks,
    modelos: { chat: CHAT_MODEL, rapido: FAST_MODEL, transcricao: TRANSCRIBE_MODEL },
    lancamento_pro_gratis: launchMode(),
  };
}

// ---------------------------------------------------------------------

const actions: Record<string, (ctx: Ctx, body: Record<string, unknown>) => Promise<unknown>> = {
  chat,
  list_chats: listChats,
  history,
  delete_chat: deleteChat,
  delete_messages: deleteMessages,
  delete_after: deleteAfter,
  edit_message: editMessage,
  log_insight: logInsight,
  arena,
  arena_feedback: arenaFeedback,
  vault_save: vaultSave,
  vault_list: vaultList,
  vault_delete: vaultDelete,
  delete_account: deleteAccount,
  plan,
  pro_interest: proInterest,
  verify_purchase: verifyPurchase,
  memory_get: memoryGet,
  memory_set: memorySet,
  memory_clear: memoryClear,
  safety_plan_get: safetyPlanGet,
  safety_plan_save: safetyPlanSave,
  weekly_summary: weeklySummary,
  journal_voice: journalVoice,
  journal_save: journalSave,
  journal_list: journalList,
  journal_delete: journalDelete,
  prep_conversation: prepConversation,
  org_status: orgStatus,
  org_join: orgJoin,
  org_leave: orgLeave,
  org_dashboard: orgDashboard,
  org_set_sector: orgSetSector,
  org_sector_create: orgSectorCreate,
  org_sector_delete: orgSectorDelete,
  org_set_label: orgSetLabel,
  tts_info: ttsInfo,
  tts,
  achievements,
  monthly_report: monthlyReport,
  health,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Faça login para continuar");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) throw new HttpError(401, "Sessão expirada. Entre de novo.");

    const body = await req.json().catch(() => ({}));
    const handler = actions[String(body.action ?? "")];
    if (!handler && body.action !== "chat_stream") throw new HttpError(400, "Ação desconhecida");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const ctx: Ctx = {
      db,
      admin,
      userId: user.id,
      email: user.email ?? null,
      meta: (user.user_metadata ?? {}) as Record<string, unknown>,
    };
    if (body.action === "chat_stream") return await chatStream(ctx, body);
    return json(await handler!(ctx, body));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
