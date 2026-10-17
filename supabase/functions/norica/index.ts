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
import { CHAT_MODEL, CHAT_REASONING, type ChatMessage, FAST_MODEL, groqChat, groqChatStream, parseJsonObject, TRANSCRIBE_MODEL } from "../_shared/groq.ts";
import { firstNameFrom } from "../_shared/names.ts";
import { consume, getPlan, launchMode, PLAN_LIMITS, usageToday } from "../_shared/plans.ts";
import { checkSubscription, PRO_PRODUCT_ID } from "../_shared/google-play.ts";
import { synthesize, TTS_VOICES, ttsConfigured } from "../_shared/tts.ts";
import { pushConfigured, pushSoon } from "../_shared/push.ts";
import { meditacaoById } from "../_shared/meditacoes.ts";
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
  const feeling = typeof body.feeling === "string" ? body.feeling.replace(/[^\p{L}\p{N} \-]/gu, "").trim().slice(0, 40) || null : null;
  const todayNote = typeof body.todayNote === "string" ? body.todayNote.replace(/[\r\n]+/g, " ").trim().slice(0, 120) || null : null;
  const phase = typeof body.phase === "string" && PHASES.includes(body.phase) ? body.phase : null;
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

  // Como as últimas respostas começaram: a IA evita repetir a mesma abertura.
  const recentOpenings = history.filter((m) => m.role === "assistant").slice(-3)
    .map((m) => m.content.replace(/\s+/g, " ").trim().split(" ").slice(0, 5).join(" "))
    .filter((x) => x.length > 3);
  const promptOptions = { mood, feeling, todayNote, phase, crisis, risk, name, mode, context, memory: memoryInfo.content, now: brtNow(), recentOpenings };
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
    reply = await groqChat(modelMessages(prep), { reasoning: CHAT_REASONING });
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
        reply = await groqChatStream(modelMessages(prep), (text) => send({ type: "delta", text }), { signal: upstream.signal, reasoning: CHAT_REASONING });
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

/** Modo fase difícil: a pessoa avisa que está atravessando algo pesado (a Nórica fica mais gentil). */
const PHASES = ["luto", "termino", "demissao", "doenca", "mudanca", "cansaco", "outro"];
const JOURNAL_KINDS = ["voz", "gratidao", "conversa", "aterramento", "noite", "terapia", "hoje"];

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

// ---------------------------------------------------------------------
// Foguinho com amigos (duplas de cuidado)
// Os dois marcam o dia (humor, Logs ou diário) e a chama cresce. Ninguém vê o conteúdo
// do outro: só se marcou hoje e o tamanho da chama. Um "dia de descanso" por semana não apaga.
// ---------------------------------------------------------------------

const MAX_PAIRS = 5;
const NUDGE_KINDS = ["apoio", "pensei", "parabens", "sumido"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function activeDays(ctx: Ctx, userIds: string[], since: string): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>(userIds.map((u) => [u, new Set<string>()]));
  if (!userIds.length) return out;
  const [{ data: moods }, { data: habits }, { data: journal }] = await Promise.all([
    ctx.admin.from("mood_logs").select("user_id, created_at").in("user_id", userIds).gte("created_at", dayStartIso(since)),
    ctx.admin.from("habit_logs").select("user_id, day, progress").in("user_id", userIds).gte("day", since),
    ctx.admin.from("journal_entries").select("user_id, created_at").in("user_id", userIds).gte("created_at", dayStartIso(since)),
  ]);
  const dayOfTs = (ts: string) => brtDay(new Date(new Date(ts).getTime() - 3 * 3600_000));
  for (const m of moods ?? []) out.get(m.user_id)?.add(dayOfTs(m.created_at));
  for (const h of habits ?? []) if (Number(h.progress) > 0) out.get(h.user_id)?.add(h.day);
  for (const j of journal ?? []) out.get(j.user_id)?.add(dayOfTs(j.created_at));
  return out;
}

/** Chama da dupla: dias seguidos em que os dois marcaram. Hoje ainda pode acontecer. */
/** Dias seguidos em que "ok(dia)" é verdade, perdoando 1 dia por semana (dia de descanso). Hoje ainda pode acontecer. */
function streakOf(ok: (d: string) => boolean, today: string) {
  let streak = 0;
  let restUsedAt: string | null = null;
  let day = ok(today) ? today : addDays(today, -1);
  for (let i = 0; i < 400; i++) {
    if (ok(day)) { streak++; day = addDays(day, -1); continue; }
    const restOk = !restUsedAt || (new Date(`${restUsedAt}T12:00:00Z`).getTime() - new Date(`${day}T12:00:00Z`).getTime()) >= 7 * 86400_000;
    if (streak > 0 && restOk && ok(addDays(day, -1))) { restUsedAt = day; day = addDays(day, -1); continue; }
    break;
  }
  return { streak, restUsed: restUsedAt !== null };
}

/** Chama da dupla: dias seguidos em que os dois marcaram. */
function pairFlame(a: Set<string>, b: Set<string>, today: string) {
  const both = (d: string) => a.has(d) && b.has(d);
  return { ...streakOf(both, today), bothToday: both(today), meToday: a.has(today), friendToday: b.has(today) };
}

function daysSince(days: Set<string>, today: string): number | null {
  for (let i = 0; i <= 30; i++) if (days.has(addDays(today, -i))) return i;
  return null;
}

async function friendsInvite(ctx: Ctx) {
  const name = (await personName(ctx)) ?? "Alguém";
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  await ctx.admin.from("care_invites").delete().eq("user_id", ctx.userId);
  const { error } = await ctx.admin.from("care_invites").insert({ code, user_id: ctx.userId, name, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() });
  if (error) throw new HttpError(500, "Não foi possível criar o convite");
  return { code, expiresInDays: 7 };
}

async function myPairs(ctx: Ctx) {
  const { data } = await ctx.admin.from("care_pairs").select("id, user_a, user_b, name_a, name_b, created_at, read_a, read_b, share_a, share_b")
    .or(`user_a.eq.${ctx.userId},user_b.eq.${ctx.userId}`).limit(MAX_PAIRS + 1);
  return data ?? [];
}

async function friendsJoin(ctx: Ctx, body: Record<string, unknown>) {
  const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) throw new HttpError(400, "O código tem 6 letras e números");
  const { data: inv } = await ctx.admin.from("care_invites").select("code, user_id, name, expires_at").eq("code", code).maybeSingle();
  if (!inv || new Date(inv.expires_at).getTime() < Date.now()) throw new HttpError(404, "Convite não encontrado ou vencido. Peça um código novo.");
  if (inv.user_id === ctx.userId) throw new HttpError(400, "Esse é o seu próprio código. Mande para um amigo 💛");
  if (await isBlocked(ctx, inv.user_id)) throw new HttpError(404, "Convite não encontrado ou vencido. Peça um código novo.");
  const pairs = await myPairs(ctx);
  if (pairs.some((p) => p.user_a === inv.user_id || p.user_b === inv.user_id)) throw new HttpError(409, "Vocês já estão juntos no foguinho 🔥");
  if (pairs.length >= MAX_PAIRS) throw new HttpError(409, `Você já tem ${MAX_PAIRS} amigos no foguinho.`);
  const myName = (await personName(ctx)) ?? "Alguém";
  const { error } = await ctx.admin.from("care_pairs").insert({ user_a: inv.user_id, user_b: ctx.userId, name_a: inv.name, name_b: myName });
  if (error) throw new HttpError(409, "Não foi possível juntar vocês agora");
  await ctx.admin.from("care_invites").delete().eq("code", code);
  await pushSoon(ctx.admin, [inv.user_id], { title: "Foguinho aceso! 🔥", body: `${myName} aceitou seu convite. Marquem o dia para a chama crescer.`, route: "/amigos/" });
  return friendsList(ctx);
}

const CHALLENGES: Record<string, { habit: number; title: string; emoji: string }> = {
  agua: { habit: 1, title: "Beber água", emoji: "💧" },
  caminhar: { habit: 19, title: "Sair de casa um pouco", emoji: "🚶" },
  respirar: { habit: 7, title: "Respirar fundo", emoji: "🌬️" },
  telas: { habit: 8, title: "Um tempo longe das telas", emoji: "📵" },
  gratidao: { habit: 9, title: "Anotar minhas reflexões", emoji: "✍️" },
  alongar: { habit: 6, title: "Alongar o corpo", emoji: "🧘" },
};

async function friendsList(ctx: Ctx) {
  const pairs = await myPairs(ctx);
  const today = brtDay();
  const friendIds = pairs.map((p) => (p.user_a === ctx.userId ? p.user_b : p.user_a));
  const days = await activeDays(ctx, [ctx.userId, ...friendIds], addDays(today, -120));
  const mine = days.get(ctx.userId) ?? new Set<string>();
  const pairIds = pairs.map((p) => p.id);
  const [{ data: unseen }, { data: msgs }, { data: challenges }] = await Promise.all([
    ctx.admin.from("care_nudges").select("id, pair_id, kind, created_at").eq("to_user", ctx.userId).is("seen_at", null).order("created_at", { ascending: false }).limit(20),
    pairIds.length ? ctx.admin.from("care_messages").select("pair_id, from_user, created_at").in("pair_id", pairIds).gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()) : Promise.resolve({ data: [] as any[] }),
    pairIds.length ? ctx.admin.from("care_challenges").select("id, pair_id, kind, days, start_day").in("pair_id", pairIds).gte("start_day", addDays(today, -40)) : Promise.resolve({ data: [] as any[] }),
  ]);
  // Hábitos de cada um nos dias dos desafios
  const habitDays = new Map<string, Map<string, number[]>>();
  if ((challenges ?? []).length) {
    const minStart = (challenges ?? []).reduce((m: string, c: any) => (c.start_day < m ? c.start_day : m), today);
    const { data: hl } = await ctx.admin.from("habit_logs").select("user_id, day, completed").in("user_id", [ctx.userId, ...friendIds]).gte("day", minStart);
    for (const h of hl ?? []) {
      if (!habitDays.has(h.user_id)) habitDays.set(h.user_id, new Map());
      habitDays.get(h.user_id)!.set(h.day, (h.completed ?? []) as number[]);
    }
  }
  const progress = (userId: string, c: any) => {
    const def = CHALLENGES[c.kind];
    let n = 0;
    for (let i = 0; i < c.days; i++) {
      const d = addDays(c.start_day, i);
      if (d > today) break;
      if (habitDays.get(userId)?.get(d)?.includes(def.habit)) n++;
    }
    return n;
  };
  return {
    friends: pairs.map((p) => {
      const iAmA = p.user_a === ctx.userId;
      const friendId = iAmA ? p.user_b : p.user_a;
      const friendDays = days.get(friendId) ?? new Set<string>();
      const flame = pairFlame(mine, friendDays, today);
      const myRead = (iAmA ? p.read_a : p.read_b) ?? "1970-01-01";
      const unread = (msgs ?? []).filter((m: any) => m.pair_id === p.id && m.from_user === friendId && m.created_at > myRead).length;
      const friendShares = iAmA ? p.share_b : p.share_a;
      const monthStart = `${today.slice(0, 7)}-01`;
      const pairChallenges = (challenges ?? []).filter((c: any) => c.pair_id === p.id)
        .map((c: any) => ({ id: c.id, kind: c.kind, title: CHALLENGES[c.kind]?.title ?? c.kind, emoji: CHALLENGES[c.kind]?.emoji ?? "⭐", days: c.days, start: c.start_day, me: progress(ctx.userId, c), friend: progress(friendId, c), ended: addDays(c.start_day, c.days - 1) < today }))
        .filter((c: any) => !c.ended || addDays(c.start, c.days + 6) >= today);
      return {
        pairId: p.id,
        name: (iAmA ? p.name_b : p.name_a) || "Amigo",
        since: p.created_at,
        ...flame,
        unread,
        daysAway: daysSince(friendDays, today),
        iShare: !!(iAmA ? p.share_a : p.share_b),
        friendWins: friendShares ? { careDaysMonth: [...friendDays].filter((d) => d >= monthStart).length, longestRun: longestRun([...friendDays]).best } : null,
        challenges: pairChallenges,
      };
    }),
    nudges: (unseen ?? []).map((n) => {
      const p = pairs.find((x) => x.id === n.pair_id);
      return { id: n.id, kind: n.kind, created_at: n.created_at, from: p ? ((p.user_a === ctx.userId ? p.name_b : p.name_a) || "Um amigo") : "Um amigo" };
    }),
    max: MAX_PAIRS,
  };
}

async function friendsNudge(ctx: Ctx, body: Record<string, unknown>) {
  const kind = String(body.kind ?? "apoio");
  if (!NUDGE_KINDS.includes(kind)) throw new HttpError(400, "Tipo inválido");
  const pair = (await myPairs(ctx)).find((p) => p.id === body.pairId);
  if (!pair) throw new HttpError(404, "Amigo não encontrado");
  const to = pair.user_a === ctx.userId ? pair.user_b : pair.user_a;
  const { count } = await ctx.admin.from("care_nudges").select("id", { count: "exact", head: true })
    .eq("pair_id", pair.id).eq("from_user", ctx.userId).gte("created_at", dayStartIso(brtDay()));
  if ((count ?? 0) >= 3) throw new HttpError(429, "Você já mandou carinho 3 vezes hoje para essa pessoa 💛");
  await ctx.admin.from("care_nudges").insert({ pair_id: pair.id, from_user: ctx.userId, to_user: to, kind });
  const me = (pair.user_a === ctx.userId ? pair.name_a : pair.name_b) || "Um amigo";
  const text: Record<string, string> = { apoio: "te mandou apoio 💛", pensei: "pensou em você 🌊", parabens: "comemorou com você 🎉", sumido: "perguntou se está tudo bem com você 💙" };
  await pushSoon(ctx.admin, [to], { title: `${me} ${text[kind]}`, body: "Abra a Nórica para ver.", route: "/amigos/" });
  return { ok: true };
}

async function friendsSeen(ctx: Ctx) {
  await ctx.admin.from("care_nudges").update({ seen_at: new Date().toISOString() }).eq("to_user", ctx.userId).is("seen_at", null);
  return { ok: true };
}

async function friendsRemove(ctx: Ctx, body: Record<string, unknown>) {
  const pair = (await myPairs(ctx)).find((p) => p.id === body.pairId);
  if (pair) await ctx.admin.from("care_pairs").delete().eq("id", pair.id);
  return friendsList(ctx);
}

async function isBlocked(ctx: Ctx, other: string) {
  const { data } = await ctx.admin.from("care_blocks").select("blocker").or(`and(blocker.eq.${ctx.userId},blocked.eq.${other}),and(blocker.eq.${other},blocked.eq.${ctx.userId})`).limit(1);
  return !!data?.length;
}

async function pairOf(ctx: Ctx, pairId: unknown) {
  const pair = (await myPairs(ctx)).find((p) => p.id === pairId);
  if (!pair) throw new HttpError(404, "Amigo não encontrado");
  const iAmA = pair.user_a === ctx.userId;
  return { pair, iAmA, friendId: iAmA ? pair.user_b : pair.user_a, myName: (iAmA ? pair.name_a : pair.name_b) || "Um amigo" };
}

// ---------- Chat entre amigos ----------

async function messageOut(ctx: Ctx, m: Record<string, any>) {
  let audioUrl: string | null = null;
  if (m.kind === "audio" && m.audio_path) {
    const { data } = await ctx.admin.storage.from("care-audio").createSignedUrl(m.audio_path, 3600);
    audioUrl = data?.signedUrl ?? null;
  }
  return { id: m.id, mine: m.from_user === ctx.userId, kind: m.kind, text: m.content ? await decrypt(m.content) : null, audioUrl, risk: !!m.risk, created_at: m.created_at };
}

async function chatList(ctx: Ctx, body: Record<string, unknown>) {
  const { pair, iAmA } = await pairOf(ctx, body.pairId);
  let q = ctx.admin.from("care_messages").select("id, from_user, kind, content, audio_path, risk, created_at").eq("pair_id", pair.id).order("created_at", { ascending: false }).limit(60);
  if (typeof body.before === "string") q = q.lt("created_at", body.before);
  const { data } = await q;
  await ctx.admin.from("care_pairs").update(iAmA ? { read_a: new Date().toISOString() } : { read_b: new Date().toISOString() }).eq("id", pair.id);
  return { messages: await Promise.all((data ?? []).reverse().map((m) => messageOut(ctx, m))) };
}

async function chatSend(ctx: Ctx, body: Record<string, unknown>) {
  const { pair, friendId, myName } = await pairOf(ctx, body.pairId);
  const text = cleanText(body.text, 1000);
  const { count } = await ctx.admin.from("care_messages").select("id", { count: "exact", head: true })
    .eq("from_user", ctx.userId).gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((count ?? 0) >= 20) throw new HttpError(429, "Calma 🙂 Muitas mensagens em um minuto.");
  const risk = detectRisk(text);
  const { data, error } = await ctx.admin.from("care_messages")
    .insert({ pair_id: pair.id, from_user: ctx.userId, kind: "texto", content: await encrypt(text), risk })
    .select("id, from_user, kind, content, audio_path, risk, created_at").single();
  if (error || !data) throw new HttpError(500, "Não foi possível enviar agora");
  await pushSoon(ctx.admin, [friendId], { title: `${myName} te mandou uma mensagem 💬`, body: "Toque para ler na Nórica.", route: `/amigos/chat/?pair=${pair.id}` });
  return { message: await messageOut(ctx, data), crisis: risk };
}

async function chatAudio(ctx: Ctx, body: Record<string, unknown>) {
  const { pair, friendId, myName } = await pairOf(ctx, body.pairId);
  const b64 = typeof body.audio === "string" ? body.audio : "";
  if (!b64 || b64.length > 1_200_000) throw new HttpError(413, "Áudio muito longo (até 30 segundos)");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const mime = typeof body.mime === "string" && /^audio\/[a-z0-9.+-]+/i.test(body.mime) ? body.mime.split(";")[0] : "audio/webm";
  const path = `${pair.id}/${crypto.randomUUID()}.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`;
  const { error: upErr } = await ctx.admin.storage.from("care-audio").upload(path, bytes, { contentType: mime });
  if (upErr) throw new HttpError(500, "Não foi possível enviar o áudio");
  const { data, error } = await ctx.admin.from("care_messages")
    .insert({ pair_id: pair.id, from_user: ctx.userId, kind: "audio", audio_path: path })
    .select("id, from_user, kind, content, audio_path, risk, created_at").single();
  if (error || !data) throw new HttpError(500, "Não foi possível enviar o áudio");
  await pushSoon(ctx.admin, [friendId], { title: `${myName} te mandou um áudio 🎧`, body: "Toque para ouvir na Nórica.", route: `/amigos/chat/?pair=${pair.id}` });
  return { message: await messageOut(ctx, data) };
}

async function chatClear(ctx: Ctx, body: Record<string, unknown>) {
  const { pair } = await pairOf(ctx, body.pairId);
  const { data: audios } = await ctx.admin.from("care_messages").select("audio_path").eq("pair_id", pair.id).not("audio_path", "is", null);
  const paths = (audios ?? []).map((a) => a.audio_path).filter(Boolean);
  if (paths.length) await ctx.admin.storage.from("care-audio").remove(paths);
  await ctx.admin.from("care_messages").delete().eq("pair_id", pair.id);
  return { ok: true };
}

async function friendsBlock(ctx: Ctx, body: Record<string, unknown>) {
  const { pair, friendId } = await pairOf(ctx, body.pairId);
  await ctx.admin.from("care_blocks").upsert({ blocker: ctx.userId, blocked: friendId }, { onConflict: "blocker,blocked", ignoreDuplicates: true });
  if (typeof body.reason === "string" && body.reason.trim()) {
    const { data: last } = await ctx.admin.from("care_messages").select("from_user, content, created_at").eq("pair_id", pair.id).order("created_at", { ascending: false }).limit(15);
    const lines: string[] = [];
    for (const m of (last ?? []).reverse()) if (m.content) lines.push(`${m.from_user === ctx.userId ? "denunciante" : "denunciado"} ${m.created_at}: ${await decrypt(m.content)}`);
    await ctx.admin.from("care_reports").insert({ reporter: ctx.userId, reported: friendId, reason: body.reason.trim().slice(0, 300), excerpt: lines.length ? await encrypt(lines.join("\n")) : null });
  }
  await ctx.admin.from("care_pairs").delete().eq("id", pair.id);
  return friendsList(ctx);
}

async function friendsShare(ctx: Ctx, body: Record<string, unknown>) {
  const { pair, iAmA } = await pairOf(ctx, body.pairId);
  await ctx.admin.from("care_pairs").update(iAmA ? { share_a: body.share === true } : { share_b: body.share === true }).eq("id", pair.id);
  return friendsList(ctx);
}

async function challengeCreate(ctx: Ctx, body: Record<string, unknown>) {
  const { pair, friendId, myName } = await pairOf(ctx, body.pairId);
  const kind = String(body.kind ?? "");
  if (!CHALLENGES[kind]) throw new HttpError(400, "Desafio inválido");
  const days = [3, 7, 14, 21, 30].includes(Number(body.days)) ? Number(body.days) : 7;
  const today = brtDay();
  const { data: active } = await ctx.admin.from("care_challenges").select("id, start_day, days").eq("pair_id", pair.id);
  if ((active ?? []).filter((c) => addDays(c.start_day, c.days - 1) >= today).length >= 3) throw new HttpError(409, "Vocês já têm 3 desafios ao mesmo tempo. Terminem um primeiro 🙂");
  await ctx.admin.from("care_challenges").insert({ pair_id: pair.id, kind, days, start_day: today, created_by: ctx.userId });
  await pushSoon(ctx.admin, [friendId], { title: `${myName} começou um desafio com você ${CHALLENGES[kind].emoji}`, body: `${CHALLENGES[kind].title} por ${days} dias. Bora?`, route: "/amigos/" });
  return friendsList(ctx);
}

async function challengeEnd(ctx: Ctx, body: Record<string, unknown>) {
  const pairs = await myPairs(ctx);
  const { data: c } = await ctx.admin.from("care_challenges").select("id, pair_id").eq("id", String(body.id ?? "")).maybeSingle();
  if (!c || !pairs.some((p) => p.id === c.pair_id)) throw new HttpError(404, "Desafio não encontrado");
  await ctx.admin.from("care_challenges").delete().eq("id", c.id);
  return friendsList(ctx);
}

// ---------- Foguinho de grupo (3 a 6 pessoas) ----------

const GROUP_MAX = 6;
const MAX_GROUPS = 3;

async function groupsList(ctx: Ctx) {
  const { data: mine } = await ctx.admin.from("care_group_members").select("group_id").eq("user_id", ctx.userId);
  const ids = (mine ?? []).map((m) => m.group_id);
  if (!ids.length) return { groups: [] };
  const [{ data: groups }, { data: members }] = await Promise.all([
    ctx.admin.from("care_groups").select("id, name, code, created_by").in("id", ids),
    ctx.admin.from("care_group_members").select("group_id, user_id, name").in("group_id", ids),
  ]);
  const today = brtDay();
  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const days = await activeDays(ctx, userIds, addDays(today, -120));
  return {
    groups: (groups ?? []).map((g) => {
      const ms = (members ?? []).filter((m) => m.group_id === g.id);
      const need = Math.max(2, Math.ceil(ms.length * 0.6));
      const ok = (d: string) => ms.filter((m) => days.get(m.user_id)?.has(d)).length >= need;
      return {
        id: g.id,
        name: g.name,
        code: g.code,
        need,
        ...streakOf(ok, today),
        litToday: ok(today),
        members: ms.map((m) => ({ name: m.user_id === ctx.userId ? "Você" : m.name || "Amigo", me: m.user_id === ctx.userId, today: !!days.get(m.user_id)?.has(today) })),
      };
    }),
  };
}

async function groupsCreate(ctx: Ctx, body: Record<string, unknown>) {
  const name = cleanText(body.name, 40);
  const { count } = await ctx.admin.from("care_group_members").select("group_id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if ((count ?? 0) >= MAX_GROUPS) throw new HttpError(409, `Você já está em ${MAX_GROUPS} grupos.`);
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  const { data: g, error } = await ctx.admin.from("care_groups").insert({ name, code, created_by: ctx.userId }).select("id").single();
  if (error || !g) throw new HttpError(500, "Não foi possível criar o grupo");
  await ctx.admin.from("care_group_members").insert({ group_id: g.id, user_id: ctx.userId, name: (await personName(ctx)) ?? "Alguém" });
  return groupsList(ctx);
}

async function groupsJoin(ctx: Ctx, body: Record<string, unknown>) {
  const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { data: g } = await ctx.admin.from("care_groups").select("id, name, created_by").eq("code", code).maybeSingle();
  if (!g) throw new HttpError(404, "Grupo não encontrado. Confira o código.");
  const { data: ms } = await ctx.admin.from("care_group_members").select("user_id").eq("group_id", g.id);
  if ((ms ?? []).some((m) => m.user_id === ctx.userId)) throw new HttpError(409, "Você já está nesse grupo 🔥");
  if ((ms ?? []).length >= GROUP_MAX) throw new HttpError(409, `Esse grupo já tem ${GROUP_MAX} pessoas.`);
  const { count } = await ctx.admin.from("care_group_members").select("group_id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if ((count ?? 0) >= MAX_GROUPS) throw new HttpError(409, `Você já está em ${MAX_GROUPS} grupos.`);
  const myName = (await personName(ctx)) ?? "Alguém";
  await ctx.admin.from("care_group_members").insert({ group_id: g.id, user_id: ctx.userId, name: myName });
  await pushSoon(ctx.admin, (ms ?? []).map((m) => m.user_id), { title: `${myName} entrou no ${g.name} 🔥`, body: "O foguinho do grupo ficou maior.", route: "/amigos/" });
  return groupsList(ctx);
}

async function groupsLeave(ctx: Ctx, body: Record<string, unknown>) {
  await ctx.admin.from("care_group_members").delete().eq("group_id", String(body.groupId ?? "")).eq("user_id", ctx.userId);
  const { count } = await ctx.admin.from("care_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", String(body.groupId ?? ""));
  if (!count) await ctx.admin.from("care_groups").delete().eq("id", String(body.groupId ?? ""));
  return groupsList(ctx);
}

// ---------- Push (Firebase) ----------

async function pushRegister(ctx: Ctx, body: Record<string, unknown>) {
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 20 || token.length > 4096) throw new HttpError(400, "Token inválido");
  await ctx.admin.from("push_tokens").upsert({ token, user_id: ctx.userId, platform: "android", updated_at: new Date().toISOString() }, { onConflict: "token" });
  return { ok: true, server: pushConfigured() };
}

async function pushUnregister(ctx: Ctx, body: Record<string, unknown>) {
  if (typeof body.token === "string") await ctx.admin.from("push_tokens").delete().eq("token", body.token).eq("user_id", ctx.userId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Mapa de gatilhos: o que costuma vir junto dos dias difíceis e dos dias calmos
// (só com os registros da própria pessoa; nada de diagnóstico)
// ---------------------------------------------------------------------

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

async function patterns(ctx: Ctx) {
  const today = brtDay();
  const start = addDays(today, -59);
  const [{ data: moods }, { data: habits }, { data: days }] = await Promise.all([
    ctx.db.from("mood_logs").select("*").eq("user_id", ctx.userId).gte("created_at", dayStartIso(start)).order("created_at", { ascending: true }),
    ctx.db.from("habit_logs").select("day, completed").eq("user_id", ctx.userId).gte("day", start),
    ctx.db.from("daily_logs").select("date, humor, assunto").eq("user_id", ctx.userId).gte("date", start),
  ]);
  const moodByDay: Record<string, string> = {};
  const feelingsHard = new Map<string, number>();
  const feelingsCalm = new Map<string, number>();
  for (const d of days ?? []) if (d.humor) moodByDay[d.date] = d.humor;
  for (const m of moods ?? []) {
    const day = brtDay(new Date(new Date(m.created_at).getTime() - 3 * 3600_000));
    moodByDay[day] = m.mood;
    const f = typeof m.feeling === "string" ? m.feeling : null;
    if (f) {
      const map = m.mood === "calmo" ? feelingsCalm : m.mood === "agitado" || m.mood === "sos" || m.mood === "ansioso" ? feelingsHard : null;
      map?.set(f, (map.get(f) ?? 0) + 1);
    }
  }
  const hard = (m: string) => m === "agitado" || m === "sos" || m === "ansioso";
  const markedDays = Object.keys(moodByDay);
  if (markedDays.length < 6) return { enough: false, daysMarked: markedDays.length, needed: 6 };

  const habitsByDay: Record<string, number[]> = {};
  for (const h of habits ?? []) habitsByDay[h.day] = (h.completed ?? []) as number[];
  const hardDays = markedDays.filter((d) => hard(moodByDay[d]));
  const calmDays = markedDays.filter((d) => moodByDay[d] === "calmo");
  const rate = (list: string[], id: number) => (list.length ? list.filter((d) => (habitsByDay[d] ?? []).includes(id)).length / list.length : 0);
  const ids = new Set<number>();
  for (const d of markedDays) for (const id of habitsByDay[d] ?? []) ids.add(id);
  const habitDiff = [...ids].map((id) => ({ id, calm: Math.round(100 * rate(calmDays, id)), hard: Math.round(100 * rate(hardDays, id)) }))
    .filter((x) => Math.abs(x.calm - x.hard) >= 20);
  const helps = habitDiff.filter((x) => x.calm > x.hard).sort((a, b) => (b.calm - b.hard) - (a.calm - a.hard)).slice(0, 3);
  const missing = habitDiff.filter((x) => x.hard > x.calm).sort((a, b) => (b.hard - b.calm) - (a.hard - a.calm)).slice(0, 2);

  // Dias da semana mais pesados
  const byWeekday = Array.from({ length: 7 }, () => ({ total: 0, hard: 0 }));
  for (const d of markedDays) {
    const w = new Date(`${d}T12:00:00Z`).getUTCDay();
    byWeekday[w].total++;
    if (hard(moodByDay[d])) byWeekday[w].hard++;
  }
  const heavyWeekday = byWeekday.map((v, i) => ({ day: WEEKDAYS[i], pct: v.total >= 2 ? Math.round((100 * v.hard) / v.total) : -1 }))
    .filter((x) => x.pct >= 50).sort((a, b) => b.pct - a.pct)[0] ?? null;

  // Assuntos que aparecem nos dias difíceis
  const topicCount = new Map<string, number>();
  for (const d of days ?? []) if (d.assunto && hard(moodByDay[d.date] ?? "")) {
    const t = String(d.assunto).toLowerCase();
    topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  }
  const hardTopics = [...topicCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

  // Depois de um dia difícil, o dia seguinte costuma ser melhor? (recuperação)
  let after = 0, recovered = 0;
  for (const d of hardDays) {
    const next = moodByDay[addDays(d, 1)];
    if (next) { after++; if (next === "calmo") recovered++; }
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f);

  return {
    enough: true,
    daysMarked: markedDays.length,
    hardDays: hardDays.length,
    calmDays: calmDays.length,
    helps,
    missing,
    heavyWeekday,
    hardTopics,
    feelingsHard: top(feelingsHard),
    feelingsCalm: top(feelingsCalm),
    recovery: after >= 3 ? Math.round((100 * recovered) / after) : null,
  };
}

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

type Membership = { orgId: string; name: string; role: string; sectorId: string | null; sectorLabel: string; kind?: string; demo?: boolean };

async function myMembership(ctx: Ctx, role?: "admin"): Promise<Membership | null> {
  let query = ctx.admin.from("org_members").select("org_id, role, sector_id").eq("user_id", ctx.userId);
  if (role) query = query.eq("role", role);
  const { data: rows } = await query.order("role", { ascending: true }).limit(1);
  const m = rows?.[0];
  if (!m) return null;
  const { data: org } = await ctx.admin.from("organizations").select("id, name, sector_label, kind, demo").eq("id", m.org_id).maybeSingle();
  return org
    ? { orgId: org.id as string, name: org.name as string, role: m.role as string, sectorId: (m.sector_id as string) ?? null, sectorLabel: (org.sector_label as string) || "Setor", kind: (org.kind as string) || "empresa", demo: !!org.demo }
    : null;
}

async function sectorsOf(ctx: Ctx, orgId: string) {
  const { data } = await ctx.admin.from("org_sectors").select("id, name").eq("org_id", orgId).order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string }[];
}

async function orgOut(ctx: Ctx, m: Membership | null) {
  if (!m) return { org: null };
  const [sectors, campaigns] = await Promise.all([sectorsOf(ctx, m.orgId), activeCampaigns(ctx, m.orgId)]);
  return { org: { name: m.name, role: m.role, kind: m.kind ?? "empresa", sectorId: m.sectorId, sectorLabel: m.sectorLabel, sectors, campaigns } };
}

// ---------------------------------------------------------------------
// Campanhas da instituição (aparecem na Início de quem faz parte dela)
// ---------------------------------------------------------------------

const CAMPAIGN_KINDS = ["setembro", "provas", "pausa", "sono", "livre", "janeiro", "voltaaulas", "saudemental", "fimdeano", "outubrorosa", "novembroazul", "ansiedade"];

async function activeCampaigns(ctx: Ctx, orgId: string) {
  const today = brtDay();
  const { data } = await ctx.admin.from("org_campaigns").select("id, kind, title, message, starts_on, ends_on")
    .eq("org_id", orgId).lte("starts_on", today).gte("ends_on", today).order("starts_on", { ascending: false }).limit(3);
  return data ?? [];
}

async function campaignsOf(ctx: Ctx, orgId: string) {
  const { data } = await ctx.admin.from("org_campaigns").select("id, kind, title, message, starts_on, ends_on")
    .eq("org_id", orgId).gte("ends_on", addDays(brtDay(), -30)).order("starts_on", { ascending: false }).limit(20);
  return data ?? [];
}

async function orgCampaignCreate(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me) throw new HttpError(403, "Só a equipe da instituição pode criar campanhas");
  const kind = String(body.kind ?? "livre");
  if (!CAMPAIGN_KINDS.includes(kind)) throw new HttpError(400, "Tipo de campanha inválido");
  const title = cleanText(body.title, 60);
  const message = cleanText(body.message, 280);
  const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const starts = isDay(body.startsOn) ? String(body.startsOn) : brtDay();
  const ends = isDay(body.endsOn) ? String(body.endsOn) : addDays(starts, 6);
  if (ends < starts) throw new HttpError(400, "A data final precisa ser depois da inicial");
  if (ends > addDays(starts, 60)) throw new HttpError(400, "Campanhas duram no máximo 60 dias");
  const { error } = await ctx.admin.from("org_campaigns").insert({ org_id: me.orgId, kind, title, message, starts_on: starts, ends_on: ends });
  if (error) throw new HttpError(500, "Não foi possível criar a campanha");
  return { campaigns: await campaignsOf(ctx, me.orgId) };
}

async function orgCampaignDelete(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me) throw new HttpError(403, "Só a equipe da instituição pode remover campanhas");
  await ctx.admin.from("org_campaigns").delete().eq("org_id", me.orgId).eq("id", String(body.id ?? ""));
  return { campaigns: await campaignsOf(ctx, me.orgId) };
}

// ---------------------------------------------------------------------
// Cartas para o futuro: escrita hoje, só pode ser lida na data escolhida
// ---------------------------------------------------------------------

const LETTER_DAYS = [7, 30, 90, 180, 365];

async function letterOut(row: Record<string, unknown>) {
  const delivered = new Date(String(row.deliver_at)).getTime() <= Date.now();
  return {
    id: row.id,
    created_at: row.created_at,
    deliver_at: row.deliver_at,
    opened: !!row.opened_at,
    delivered,
    content: delivered ? await decrypt(String(row.content)) : null,
  };
}

async function letterSave(ctx: Ctx, body: Record<string, unknown>) {
  const content = cleanText(body.content, 4000);
  const days = Number(body.days);
  if (!LETTER_DAYS.includes(days)) throw new HttpError(400, "Escolha quando a carta chega");
  const { count } = await ctx.admin.from("future_letters").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("opened_at", null);
  if ((count ?? 0) >= 20) throw new HttpError(429, "Você já tem 20 cartas esperando. Leia algumas antes de escrever mais.");
  const deliver = new Date(Date.now() + days * 86400_000);
  deliver.setUTCHours(13, 0, 0, 0); // 10h em Brasília
  const { data, error } = await ctx.admin.from("future_letters")
    .insert({ user_id: ctx.userId, content: await encrypt(content), deliver_at: deliver.toISOString() })
    .select("id, content, deliver_at, opened_at, created_at").single();
  if (error || !data) throw new HttpError(500, "Não foi possível guardar a carta");
  return { letter: await letterOut(data), crisis: detectRisk(content) };
}

async function letterList(ctx: Ctx) {
  const { data } = await ctx.admin.from("future_letters").select("id, content, deliver_at, opened_at, created_at")
    .eq("user_id", ctx.userId).order("deliver_at", { ascending: true }).limit(50);
  return { letters: await Promise.all((data ?? []).map(letterOut)) };
}

async function letterOpen(ctx: Ctx, body: Record<string, unknown>) {
  const { data } = await ctx.admin.from("future_letters").select("id, content, deliver_at, opened_at, created_at")
    .eq("user_id", ctx.userId).eq("id", String(body.id ?? "")).maybeSingle();
  if (!data) throw new HttpError(404, "Carta não encontrada");
  if (new Date(data.deliver_at).getTime() > Date.now()) throw new HttpError(403, "Essa carta ainda está a caminho");
  if (!data.opened_at) await ctx.admin.from("future_letters").update({ opened_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", ctx.userId);
  return { letter: await letterOut({ ...data, opened_at: data.opened_at ?? new Date().toISOString() }) };
}

async function letterDelete(ctx: Ctx, body: Record<string, unknown>) {
  await ctx.admin.from("future_letters").delete().eq("user_id", ctx.userId).eq("id", String(body.id ?? ""));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Instituição criada pelo próprio app (escola, cursinho ou empresa)
// ---------------------------------------------------------------------

const TRIAL_DAYS = 30;
const ORG_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(prefix: string, n: number) {
  let c = prefix;
  for (let i = 0; i < n; i++) c += ORG_CODE_CHARS[Math.floor(Math.random() * ORG_CODE_CHARS.length)];
  return c.slice(0, 12);
}

/** Código fácil de passar: começo do nome + números/letras (ex.: COLEGIO4K7). */
async function newOrgCode(ctx: Ctx, name: string, team = false) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, team ? 4 : 7) || "NORICA";
  for (let i = 0; i < 8; i++) {
    const code = randomCode(team ? `EQ${base}` : base, team ? 4 : 3);
    const col = team ? "admin_code" : "code";
    const { data } = await ctx.admin.from("organizations").select("id").eq(col, code).maybeSingle();
    if (!data) return code;
  }
  throw new HttpError(500, "Não foi possível gerar o código agora");
}

async function orgCreate(ctx: Ctx, body: Record<string, unknown>) {
  const name = cleanText(body.name, 80);
  if (name.length < 3) throw new HttpError(400, "Escreva o nome da instituição");
  const kind = ["escola", "empresa", "outro"].includes(String(body.kind)) ? String(body.kind) : "empresa";
  const { count } = await ctx.admin.from("organizations").select("id", { count: "exact", head: true }).eq("created_by", ctx.userId);
  if ((count ?? 0) >= 3) throw new HttpError(409, "Você já criou 3 instituições. Fale com a gente para criar mais.");
  const code = await newOrgCode(ctx, name);
  const adminCode = await newOrgCode(ctx, name, true);
  const { data: org, error } = await ctx.admin.from("organizations").insert({
    name, code, admin_code: adminCode, kind, created_by: ctx.userId, plan: "teste",
    trial_until: addDays(brtDay(), TRIAL_DAYS), sector_label: kind === "escola" ? "Turma" : "Setor",
  }).select("id").single();
  if (error || !org) throw new HttpError(500, "Não foi possível criar a instituição");
  await leaveDemos(ctx);
  await ctx.admin.from("org_members").upsert({ org_id: org.id, user_id: ctx.userId, role: "admin" }, { onConflict: "org_id,user_id" });
  return orgOut(ctx, await myMembership(ctx, "admin"));
}

async function orgDetails(ctx: Ctx, me: Membership) {
  const { data: o } = await ctx.admin.from("organizations").select("code, admin_code, kind, plan, trial_until, created_by, demo").eq("id", me.orgId).maybeSingle();
  const { data: ms } = await ctx.admin.from("org_members").select("role").eq("org_id", me.orgId);
  return {
    code: o?.code ?? null,
    adminCode: o?.demo ? null : o?.admin_code ?? null,
    kind: o?.kind ?? "empresa",
    plan: o?.plan ?? "teste",
    trialUntil: o?.trial_until ?? null,
    owner: o?.created_by === ctx.userId,
    team: (ms ?? []).filter((m) => m.role === "admin").length,
  };
}

async function orgRename(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me || me.demo) throw new HttpError(403, "Só a equipe da instituição pode mudar isso");
  const name = cleanText(body.name, 80);
  if (name.length < 3) throw new HttpError(400, "Nome muito curto");
  await ctx.admin.from("organizations").update({ name }).eq("id", me.orgId);
  return { ok: true, name };
}

async function orgNewCode(ctx: Ctx, body: Record<string, unknown>) {
  const me = await myMembership(ctx, "admin");
  if (!me || me.demo) throw new HttpError(403, "Só a equipe da instituição pode mudar isso");
  const team = body.team === true;
  const code = await newOrgCode(ctx, me.name, team);
  await ctx.admin.from("organizations").update(team ? { admin_code: code } : { code }).eq("id", me.orgId);
  return { info: await orgDetails(ctx, me) };
}

async function orgDelete(ctx: Ctx) {
  const me = await myMembership(ctx, "admin");
  if (!me || me.demo) throw new HttpError(403, "Só quem criou a instituição pode apagá-la");
  const { data: o } = await ctx.admin.from("organizations").select("created_by").eq("id", me.orgId).maybeSingle();
  if (o?.created_by !== ctx.userId) throw new HttpError(403, "Só quem criou a instituição pode apagá-la");
  await ctx.admin.from("organizations").delete().eq("id", me.orgId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Página "Para escolas e empresas": contato para agendar conversa (sem login)
// ---------------------------------------------------------------------

async function leadCreate(admin: SupabaseClient, body: Record<string, unknown>, ip: string) {
  const txt = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const name = txt(body.name, 80);
  const orgName = txt(body.orgName, 120);
  const kind = ["escola", "empresa", "outro"].includes(String(body.kind)) ? String(body.kind) : "outro";
  const phone = txt(body.phone, 30).replace(/[^0-9+()\s-]/g, "");
  const email = txt(body.email, 120).toLowerCase();
  if (name.length < 2 || orgName.length < 2) throw new HttpError(400, "Preencha seu nome e o da instituição");
  if (!phone && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Deixe um WhatsApp ou e-mail para a gente falar com você");
  if (typeof body.site === "string" && body.site) return { ok: true }; // robô (campo escondido preenchido)
  const ipHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`norica:${ip}`))))
    .slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { count } = await admin.from("leads").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 5) throw new HttpError(429, "Recebemos seus pedidos. Logo entramos em contato!");
  const { error } = await admin.from("leads").insert({
    name, org_name: orgName, kind, size: txt(body.size, 40) || null, phone: phone || null,
    email: email || null, message: txt(body.message, 600) || null, ip_hash: ipHash,
  });
  if (error) throw new HttpError(500, "Não foi possível enviar agora");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Meditações guiadas: voz natural gerada uma vez por trecho e reaproveitada
// ---------------------------------------------------------------------

async function meditationAudio(ctx: Ctx, body: Record<string, unknown>) {
  const med = meditacaoById(String(body.id ?? ""));
  const idx = Number(body.part);
  if (!med || !Number.isInteger(idx) || idx < 0 || idx >= med.parts.length) throw new HttpError(404, "Meditação não encontrada");
  const voice = TTS_VOICES[String(body.voice)] ? String(body.voice) : "serena";
  const path = `${voice}/${med.id}-${idx}.wav`;
  const bucket = ctx.admin.storage.from("meditacoes");
  const signed = async () => (await bucket.createSignedUrl(path, 3600)).data?.signedUrl ?? null;
  const { data: found } = await bucket.list(voice, { search: `${med.id}-${idx}.wav`, limit: 1 });
  if (found?.some((f) => f.name === `${med.id}-${idx}.wav`)) return { url: await signed() };
  if (!ttsConfigured()) throw new HttpError(503, "Voz natural indisponível");
  try {
    const out = await synthesize(med.parts[idx].t, voice);
    const bytes = Uint8Array.from(atob(out.audio), (c) => c.charCodeAt(0));
    await bucket.upload(path, bytes, { contentType: out.mime, upsert: true });
    return { url: await signed() };
  } catch (e) {
    console.error(e);
    throw new HttpError(502, "A voz natural não respondeu agora");
  }
}

async function orgStatus(ctx: Ctx) {
  return orgOut(ctx, await myMembership(ctx));
}

async function orgJoin(ctx: Ctx, body: Record<string, unknown>) {
  const code = String(body.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4) throw new HttpError(400, "Digite o código que a instituição passou para você");
  let { data: org } = await ctx.admin.from("organizations").select("id, name, demo").eq("code", code).maybeSingle();
  let asTeam = false;
  if (!org) {
    // Código da equipe (coordenação, RH): entra direto como quem vê o painel.
    const r = await ctx.admin.from("organizations").select("id, name, demo").eq("admin_code", code).maybeSingle();
    org = r.data; asTeam = !!org;
  }
  if (!org) throw new HttpError(404, "Código não encontrado. Confira com a sua instituição.");
  await ctx.admin.from("org_members").delete().eq("user_id", ctx.userId).neq("org_id", org.id).eq("role", "member");
  await leaveDemos(ctx, org.id as string);
  // Demonstração: quem entra vê o painel como a equipe (com números fictícios).
  const { error } = await ctx.admin.from("org_members").upsert(
    { org_id: org.id, user_id: ctx.userId, ...(org.demo || asTeam ? { role: "admin" } : {}) },
    { onConflict: "org_id,user_id", ignoreDuplicates: !(org.demo || asTeam) },
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
  // Equipe pode sair se outra pessoa da equipe continuar cuidando do painel.
  const { data: mine } = await ctx.admin.from("org_members").select("org_id").eq("user_id", ctx.userId).eq("role", "admin");
  for (const m of mine ?? []) {
    const { count } = await ctx.admin.from("org_members").select("user_id", { count: "exact", head: true }).eq("org_id", m.org_id).eq("role", "admin");
    const { data: o } = await ctx.admin.from("organizations").select("demo").eq("id", m.org_id).maybeSingle();
    if (!o?.demo && (count ?? 0) > 1) await ctx.admin.from("org_members").delete().eq("org_id", m.org_id).eq("user_id", ctx.userId);
  }
  await leaveDemos(ctx);
  // Única pessoa da equipe de uma instituição real: sair deixaria o painel sem ninguém.
  const still = await myMembership(ctx, "admin");
  if (still && !still.demo) {
    throw new HttpError(409, `Você é a única pessoa da equipe de ${still.name}. Para sair, passe o código da equipe para alguém da coordenação/RH ou apague a instituição no painel (Ajustes).`);
  }
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
  if (orgRow?.demo) return { ...demoDashboard(me, await sectorsOf(ctx, me.orgId)), campaigns: await campaignsOf(ctx, me.orgId), info: await orgDetails(ctx, me) };
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
    info: await orgDetails(ctx, me),
    campaigns: await campaignsOf(ctx, me.orgId),
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
  for (const table of ["mood_logs", "habit_logs", "daily_logs", "vault_entries", "consents", "usage_events", "user_plans", "user_memory", "safety_plans", "message_feedback", "app_errors", "weekly_summaries", "journal_entries", "org_members", "monthly_reports", "future_letters", "care_invites"]) {
    await admin.from(table).delete().eq("user_id", uid);
  }
  await admin.from("care_nudges").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`);
  await admin.from("care_messages").delete().eq("from_user", uid);
  await admin.from("care_blocks").delete().or(`blocker.eq.${uid},blocked.eq.${uid}`);
  await admin.from("care_group_members").delete().eq("user_id", uid);
  await admin.from("push_tokens").delete().eq("user_id", uid);
  await admin.from("care_pairs").delete().or(`user_a.eq.${uid},user_b.eq.${uid}`);
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

  for (const table of ["chats", "messages", "mood_logs", "habit_logs", "daily_logs", "vault_entries", "consents", "user_plans", "usage_events", "app_errors", "user_memory", "safety_plans", "message_feedback", "weekly_summaries", "journal_entries", "organizations", "org_members", "org_sectors", "monthly_reports", "future_letters", "org_campaigns", "care_pairs", "care_invites", "care_nudges", "care_messages", "care_groups", "care_group_members", "care_challenges", "push_tokens", "leads"]) {
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
  org_campaign_create: orgCampaignCreate,
  org_campaign_delete: orgCampaignDelete,
  org_create: orgCreate,
  org_rename: orgRename,
  org_new_code: orgNewCode,
  org_delete: orgDelete,
  meditation_audio: meditationAudio,
  letter_save: letterSave,
  letter_list: letterList,
  letter_open: letterOpen,
  letter_delete: letterDelete,
  patterns,
  friends_invite: friendsInvite,
  friends_join: friendsJoin,
  friends_list: friendsList,
  friends_nudge: friendsNudge,
  friends_seen: friendsSeen,
  friends_remove: friendsRemove,
  friends_block: friendsBlock,
  friends_share: friendsShare,
  chat_list: chatList,
  chat_send: chatSend,
  chat_audio: chatAudio,
  chat_clear: chatClear,
  challenge_create: challengeCreate,
  challenge_end: challengeEnd,
  groups_list: groupsList,
  groups_create: groupsCreate,
  groups_join: groupsJoin,
  groups_leave: groupsLeave,
  push_register: pushRegister,
  push_unregister: pushUnregister,
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
    const body = await req.json().catch(() => ({}));
    // Única ação sem login: o formulário da página "Para escolas e empresas".
    if (body.action === "lead_create") {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
      return json(await leadCreate(admin, body, ip));
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Faça login para continuar");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) throw new HttpError(401, "Sessão expirada. Entre de novo.");

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
