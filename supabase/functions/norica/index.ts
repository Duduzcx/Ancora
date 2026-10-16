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
  for (const table of ["mood_logs", "habit_logs", "daily_logs", "vault_entries", "consents", "usage_events", "user_plans", "user_memory", "safety_plans", "message_feedback", "app_errors"]) {
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

  for (const table of ["chats", "messages", "mood_logs", "habit_logs", "daily_logs", "vault_entries", "consents", "user_plans", "usage_events", "app_errors", "user_memory", "safety_plans", "message_feedback"]) {
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
