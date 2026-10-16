// Cliente das Edge Functions da Nórica.
// O app não carrega mais nenhuma chave de IA: tudo passa pelo servidor, com login.

import { createClient } from '@/lib/supabase-client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { queueHabitLog, queueMood, readHabitLog } from '@/lib/offline-sync';
import { reportError } from '@/lib/error-report';

export type ChatMode = 'desabafar' | 'organizar' | 'acalmar' | 'passo';
export type RiskLevel = 'nenhum' | 'atencao' | 'alto';

export type ChatResult = {
  chatId: string;
  reply: string;
  crisis: boolean;
  risk?: RiskLevel;
  mode?: ChatMode | null;
  promptVersion?: string;
  title: string | null;
  tasks: string[];
  userMessageId: string | null;
  assistantMessageId: string | null;
};

export type ChatOptions = {
  mood?: Mood | null;
  mode?: ChatMode | null; // o que a pessoa precisa: desabafar, organizar, acalmar ou um passo
  persona?: 'norica' | 'clara';
  welcome?: string; // saudação mostrada no app, salva ao criar a conversa
  regenerate?: boolean; // responder de novo depois de editar uma mensagem
  signal?: AbortSignal;
};

export type ChatSummary = { id: string; title: string; created_at: string };
export type StoredMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type VaultEntry = { id: string; content: string; created_at: string };
export type TranscriptMessage = { role: 'user' | 'assistant'; content: string };

export type PlanName = 'free' | 'pro';
export type PlanInfo = {
  plan: PlanName; // plano contratado
  effective: PlanName; // plano em uso (no lançamento, todos usam o Pro)
  launch: boolean;
  proInterest: boolean;
  proUntil: string | null; // fim do período pago da assinatura
  billing: boolean; // cobrança pela Google Play configurada no servidor
  limits: Record<PlanName, { porto_message: number; arena_feedback: number }>;
  usage: { porto_message: number; arena_feedback: number };
};
export type HealthReport = {
  ok: boolean;
  checks: Record<string, { ok: boolean; detail?: string }>;
  modelos: { chat: string; rapido: string; transcricao: string };
  lancamento_pro_gratis: boolean;
};

export type SafetyPlan = {
  sinais: string; // sinais de que uma crise está chegando
  acalma: string; // o que eu faço sozinho(a) para me acalmar
  distrair: string; // pessoas e lugares que me distraem
  contatos: { nome: string; telefone: string }[]; // pessoas de confiança (até 3)
  profissionais: string; // profissionais e serviços
  motivos: string; // meus motivos para seguir
};

export type WeeklySummary = {
  weekStart: string;
  empty: boolean;
  locked: boolean; // plano Gratuito: vê só os números
  summary: string | null;
  stats: { moods: Record<string, number>; daysWithLogs: number; conversations: number; journalEntries: number };
};
export type JournalKind = 'voz' | 'gratidao' | 'conversa' | 'aterramento' | 'noite';
export type JournalEntry = { id: string; kind: JournalKind; mood: string | null; created_at: string; summary: string; content: string; title?: string };
export type OrgSector = { id: string; name: string };
export type OrgInfo = { name: string; role: 'member' | 'admin'; sectorId?: string | null; sectorLabel?: string; sectors?: OrgSector[] } | null;
export type OrgWeek = {
  active: number;
  moodPct: Record<string, number>;
  hardPeoplePct: number;
  logsPct: number;
  topics: { topic: string; pct: number }[];
};
export type OrgSectorRow = { id: string; name: string; members: number; current: OrgWeek | null; previous: OrgWeek | null };
export type AchievementStats = {
  moodCount: number; moodDays: number; habitDays: number; careDays: number; bestStreak: number; currentStreak: number;
  chats: number; voice: number; gratidao: number; conversa: number; aterramento: number; noite: number; arena: number; plan: number; weeks: number;
};
export type MonthlyReport = {
  name: string | null;
  start: string;
  end: string;
  series: { day: string; mood: string | null }[];
  moodCount: Record<string, number>;
  habitDays: number;
  habitFreq: Record<string, number>;
  topics: string[];
  journalCount: number;
  conversations: number;
  letter: string | null;
};
export type OrgDashboard = {
  org: string;
  sectorLabel: string;
  members: number;
  minGroup: number;
  current: OrgWeek | null;
  previous: OrgWeek | null;
  sectors: OrgSectorRow[];
  sectorList: OrgSector[];
  alerts: string[];
  actions: string[];
  weeks: { label: string; active: number | null; hardPeoplePct: number | null }[];
};

export const MOODS = ['calmo', 'ansioso', 'agitado', 'sos'] as const;
export type Mood = (typeof MOODS)[number];

async function readError(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch (_e) {}
  return 'Sinal fraco no Porto. Verifique sua conexão.';
}

async function call<T>(action: string, payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('norica', {
    body: { action, ...payload },
    ...(signal ? { signal } : {}),
  } as any);
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  if (error) {
    const message = await readError(error);
    // Falha do servidor (5xx) vai para o registro de erros; limites e validações (4xx) não.
    const status = (error as any)?.context?.status;
    if (typeof status === 'number' && status >= 500) reportError(new Error(`${action}: ${status} ${message}`), 'servidor');
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const noricaApi = {
  chat: (message: string, chatId: string | null, opts: ChatOptions = {}) => {
    const { signal, ...rest } = opts;
    return call<ChatResult>('chat', { message, chatId, ...rest }, signal);
  },
  deleteMessages: (chatId: string, ids: string[]) => call<{ ok: boolean }>('delete_messages', { chatId, ids }),
  deleteAfter: (chatId: string, afterId: string | null) => call<{ ok: boolean }>('delete_after', { chatId, afterId }),
  editMessage: (chatId: string, messageId: string, content: string) =>
    call<{ ok: boolean }>('edit_message', { chatId, messageId, content }),
  logInsight: (completed: string[], progress: number) =>
    call<{ insight: string }>('log_insight', { completed, progress }),
  listChats: () => call<{ chats: ChatSummary[] }>('list_chats'),
  history: (chatId: string) => call<{ messages: StoredMessage[]; title: string | null }>('history', { chatId }),
  deleteChat: (chatId: string) => call<{ ok: boolean }>('delete_chat', { chatId }),

  arena: (scenario: string, messages: TranscriptMessage[]) =>
    call<{ reply: string; crisis: boolean }>('arena', { scenario, messages }),
  arenaFeedback: (scenario: string, messages: TranscriptMessage[]) =>
    call<{ feedback: string }>('arena_feedback', { scenario, messages }),

  vaultSave: (content: string) => call<{ entry: VaultEntry }>('vault_save', { content }),
  vaultList: () => call<{ entries: VaultEntry[] }>('vault_list'),
  vaultDelete: (id: string) => call<{ ok: boolean }>('vault_delete', { id }),

  deleteAccount: () => call<{ ok: boolean }>('delete_account'),

  plan: () => call<PlanInfo>('plan'),
  proInterest: () => call<{ ok: boolean }>('pro_interest'),
  verifyPurchase: (purchaseToken: string) =>
    call<{ active: boolean; proUntil: string | null; state: string }>('verify_purchase', { purchaseToken }),
  health: () => call<HealthReport>('health'),

  memoryGet: () => call<{ enabled: boolean; items: string[]; updatedAt: string | null }>('memory_get'),
  memorySet: (enabled: boolean) => call<{ ok: boolean; enabled: boolean }>('memory_set', { enabled }),
  memoryClear: () => call<{ ok: boolean }>('memory_clear'),

  safetyPlanGet: () => call<{ plan: SafetyPlan | null; updatedAt: string | null }>('safety_plan_get'),
  safetyPlanSave: (plan: SafetyPlan) => call<{ ok: boolean; plan: SafetyPlan }>('safety_plan_save', { plan }),

  weeklySummary: (refresh = false) => call<WeeklySummary>('weekly_summary', { refresh }),

  journalVoice: (text: string) =>
    call<{ entry: JournalEntry; crisis: boolean; tasks: string[] }>('journal_voice', { text }),
  journalSave: (kind: Exclude<JournalKind, 'voz'>, content: string, summary?: string) =>
    call<{ entry: JournalEntry; crisis: boolean }>('journal_save', { kind, content, summary }),
  journalList: (limit = 10, kind?: JournalKind) => call<{ entries: JournalEntry[] }>('journal_list', { limit, kind }),
  journalDelete: (id: string) => call<{ ok: boolean }>('journal_delete', { id }),
  prepConversation: (data: { pessoa: string; objetivo: string; sentimento: string; pedido: string }) =>
    call<{ aberturas: string[]; dica: string; crisis: boolean; cenario: string }>('prep_conversation', data),

  orgStatus: () => call<{ org: OrgInfo }>('org_status'),
  orgJoin: (code: string) => call<{ org: OrgInfo }>('org_join', { code }),
  orgLeave: () => call<{ ok: boolean }>('org_leave'),
  orgDashboard: () => call<OrgDashboard>('org_dashboard'),
  orgSetSector: (sectorId: string | null) => call<{ org: OrgInfo }>('org_set_sector', { sectorId }),
  orgSectorCreate: (name: string) => call<{ sectors: OrgSector[] }>('org_sector_create', { name }),
  orgSectorDelete: (id: string) => call<{ sectors: OrgSector[] }>('org_sector_delete', { id }),
  orgSetLabel: (label: string) => call<{ sectorLabel: string }>('org_set_label', { label }),

  achievements: () => call<{ stats: AchievementStats }>('achievements'),
  monthlyReport: (refresh = false) => call<MonthlyReport>('monthly_report', { refresh }),

  async transcribe(blob: Blob): Promise<string> {
    const supabase = createClient();
    const form = new FormData();
    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    form.append('file', blob, `recording.${ext}`);
    const { data, error } = await supabase.functions.invoke('norica-transcribe', { body: form });
    if (error) throw new Error(await readError(error));
    return data?.text ?? '';
  },
};

// ---------------------------------------------------------------------
// Porto com resposta aparecendo enquanto é escrita (streaming)
// ---------------------------------------------------------------------

export type ChatStreamEvent =
  | { type: 'start'; chatId: string; userMessageId: string | null; crisis: boolean; risk?: RiskLevel; mode?: ChatMode | null }
  | { type: 'delta'; text: string }
  | ({ type: 'done' } & ChatResult)
  | { type: 'error'; error: string };

/** O servidor ainda não tem o streaming (função antiga) ou a conexão não permite: use noricaApi.chat. */
export class StreamUnavailableError extends Error {
  constructor() {
    super('streaming indisponível');
    this.name = 'StreamUnavailableError';
  }
}

export async function streamChat(
  message: string,
  chatId: string | null,
  opts: ChatOptions,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<ChatResult> {
  const { signal, ...rest } = opts;
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Faça login para continuar');

  // No Android, o fetch padrão do Capacitor (CapacitorHttp) espera a resposta inteira.
  // O fetch original do WebView entrega os pedaços conforme chegam.
  const w = window as any;
  const webFetch: typeof fetch = w.CapacitorWebFetch ? w.CapacitorWebFetch.bind(w) : window.fetch.bind(window);

  let res: Response;
  try {
    res = await webFetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/norica`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'chat_stream', message, chatId, ...rest }),
      signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new StreamUnavailableError();
  }

  const type = res.headers.get('Content-Type') ?? '';
  if (!res.ok || !type.includes('ndjson') || !res.body) {
    const body = await res.json().catch(() => null);
    if (body?.error && body.error !== 'Ação desconhecida') throw new Error(body.error);
    throw new StreamUnavailableError();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ChatResult | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let event: ChatStreamEvent;
      try {
        event = JSON.parse(line);
      } catch (_e) {
        continue;
      }
      if (event.type === 'error') throw new Error(event.error);
      if (event.type === 'done') {
        const { type: _t, ...data } = event;
        result = data as ChatResult;
      }
      onEvent(event);
    }
  }
  if (!result) throw new Error('A conexão caiu no meio da resposta. Tente de novo.');
  return result;
}

// ---------------------------------------------------------------------
// Plano com cache: as telas usam o último plano conhecido na hora
// ---------------------------------------------------------------------

export function cachedPlan(userId: string | null | undefined): PlanInfo | null {
  return cacheGet<PlanInfo>(userId, 'plan');
}

export async function refreshPlan(userId: string | null | undefined): Promise<PlanInfo> {
  const plan = await noricaApi.plan();
  cacheSet(userId, 'plan', plan);
  return plan;
}

// Acorda a função da IA ao abrir o app (a primeira chamada depois de um tempo parada
// é mais lenta) e já atualiza o plano em cache. Roda no máximo uma vez a cada 5 minutos.
let lastWarmUp = 0;
export function warmUpServer(userId: string) {
  if (Date.now() - lastWarmUp < 5 * 60_000) return;
  lastWarmUp = Date.now();
  refreshPlan(userId).catch(() => {});
}

// ---------------------------------------------------------------------
// Humor (mapa emocional)
// ---------------------------------------------------------------------

export function toMood(value: string | null | undefined): Mood | null {
  if (!value) return null;
  const v = value.toLowerCase().replace(/\./g, '');
  return (MOODS as readonly string[]).includes(v) ? (v as Mood) : null;
}

export async function logMood(mood: Mood) {
  // Último humor personaliza o lembrete de amanhã ("como você está hoje?").
  try { localStorage.setItem('norica-last-mood', JSON.stringify({ mood, at: Date.now() })); } catch (_e) {}
  // Vai para a fila do aparelho e é enviado assim que houver internet.
  await queueMood(mood);
}

// ---------------------------------------------------------------------
// Logs diários (sincronizados no Supabase, com cópia local para uso offline)
// ---------------------------------------------------------------------

export type CustomTask = { id: string; text: string; completed: boolean };
export type DailyLog = { day: string; completed: number[]; custom_tasks: CustomTask[]; progress: number };

export function todayKey(date = new Date()): string {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD no fuso do aparelho
}

export async function fetchDailyLog(day = todayKey()): Promise<DailyLog | null> {
  return (await readHabitLog(day)) as DailyLog | null;
}

export async function saveDailyLog(log: DailyLog) {
  // Grava no aparelho primeiro; sincroniza com a conta quando houver conexão.
  await queueHabitLog(log);
}

// Adiciona ações sugeridas pela IA na lista de hoje (aba Logs).
export async function addTasksToToday(texts: string[]): Promise<number> {
  const day = todayKey();
  const current = (await fetchDailyLog(day)) ?? { day, completed: [], custom_tasks: [], progress: 0 };
  const existing = new Set(current.custom_tasks.map((t) => t.text.toLowerCase()));
  const fresh = texts
    .filter((t) => !existing.has(t.toLowerCase()))
    .map((text) => ({ id: `ia-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, completed: false }));
  if (!fresh.length) return 0;
  await saveDailyLog({ ...current, custom_tasks: [...current.custom_tasks, ...fresh] });
  return fresh.length;
}


// ---------------------------------------------------------------------
// 👍/👎 nas respostas (não envia o texto da conversa)
// ---------------------------------------------------------------------

export async function sendFeedback(messageId: string, rating: 1 | -1, extra: { reason?: string | null; mode?: string | null; promptVersion?: string | null } = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  await supabase.from('message_feedback').upsert({
    message_id: messageId,
    user_id: session.user.id,
    rating,
    reason: extra.reason ?? null,
    mode: extra.mode ?? null,
    prompt_version: extra.promptVersion ?? null,
  }, { onConflict: 'message_id,user_id' });
}
