// Cliente das Edge Functions da Nórica.
// O app não carrega mais nenhuma chave de IA: tudo passa pelo servidor, com login.

import { createClient } from '@/lib/supabase-client';

export type ChatResult = {
  chatId: string;
  reply: string;
  crisis: boolean;
  title: string | null;
  tasks: string[];
  userMessageId: string | null;
  assistantMessageId: string | null;
};

export type ChatOptions = {
  mood?: Mood | null;
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
  if (error) throw new Error(await readError(error));
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
// Humor (mapa emocional)
// ---------------------------------------------------------------------

export function toMood(value: string | null | undefined): Mood | null {
  if (!value) return null;
  const v = value.toLowerCase().replace(/\./g, '');
  return (MOODS as readonly string[]).includes(v) ? (v as Mood) : null;
}

export async function logMood(mood: Mood) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  await supabase.from('mood_logs').insert({ user_id: session.user.id, mood });
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
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from('habit_logs')
    .select('day, completed, custom_tasks, progress')
    .eq('user_id', session.user.id)
    .eq('day', day)
    .maybeSingle();
  return (data as DailyLog) ?? null;
}

export async function saveDailyLog(log: DailyLog) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  await supabase.from('habit_logs').upsert({
    user_id: session.user.id,
    day: log.day,
    completed: log.completed,
    custom_tasks: log.custom_tasks,
    progress: log.progress,
    updated_at: new Date().toISOString(),
  });
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
