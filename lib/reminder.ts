"use client";

// Notificações da Nórica (lembrete diário, resumo de domingo, sequência, "sentimos sua falta").
// Notificações locais: agendadas no próprio celular, funcionam sem internet e sem servidor.
// As mensagens são personalizadas (nome, sequência, último humor) e reagendadas a cada abertura.

import { Capacitor } from '@capacitor/core';
import { reportError } from './error-report';

export type ReminderSettings = {
  enabled: boolean; // lembrete diário
  hour: number;
  minute: number;
  weekly: boolean; // domingo 19h: resumo da semana pronto
  streak: boolean; // sequência dos Logs (não perder a ofensiva)
  comeback: boolean; // depois de 3 dias sem abrir o app
};
export type ReminderResult = 'ok' | 'denied' | 'unsupported' | 'error';

const KEY = 'norica-reminder';
const CHANNEL_ID = 'lembrete-diario';
const BASE_ID = 7100; // ids 7101..7114: próximos 14 lembretes diários
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 20, minute: 0, weekly: true, streak: true, comeback: true };
const WEEKLY_ID = 7301;
const STREAK_ID = 7302;
const COMEBACK_ID = 7303;

export function getReminder(): ReminderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDER, ...JSON.parse(raw) } : DEFAULT_REMINDER;
  } catch (_e) {
    return DEFAULT_REMINDER;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  save(settings);
}

function save(settings: ReminderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (_e) {}
}

export const formatTime = (s: Pick<ReminderSettings, 'hour' | 'minute'>) =>
  `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;

// ---------------------------------------------------------------------
// Mensagens personalizadas (nome, sequência dos Logs, último humor, dia da semana)
// Não revelam nada sensível: aparecem na tela bloqueada.
// ---------------------------------------------------------------------

type PersonalContext = { name: string; streak: number; lastMood: string | null; lastMoodAt: number };

function personalContext(): PersonalContext {
  const ctx: PersonalContext = { name: '', streak: 0, lastMood: null, lastMoodAt: 0 };
  try {
    ctx.name = localStorage.getItem('norica-first-name') || '';
    ctx.streak = parseInt(localStorage.getItem('norica-streak') || '0', 10) || 0;
    const last = JSON.parse(localStorage.getItem('norica-last-mood') || 'null');
    if (last?.mood) { ctx.lastMood = last.mood; ctx.lastMoodAt = Number(last.at) || 0; }
  } catch (_e) {}
  return ctx;
}

const hi = (name: string, fallback = 'Oi') => (name ? `${fallback}, ${name}` : fallback);

// weekday do JS: 0 = domingo … 6 = sábado
const POOL: ((c: PersonalContext) => { title: string; body: string })[] = [
  (c) => ({ title: `${hi(c.name, 'Domingo de maré mansa')}? 🌊`, body: 'Tire um minuto para ver como está o seu mar antes da semana começar.' }),
  (c) => ({ title: `${hi(c.name)}, como está o seu mar hoje? ⚓`, body: 'Um toque para registrar. Começar a semana se ouvindo já é cuidado.' }),
  (c) => ({ title: 'Pausa de um minuto 🫧', body: `${c.name ? `${c.name}, respira` : 'Respira'} fundo comigo e conta como foi o dia.` }),
  (c) => ({ title: 'Meio da semana, meio do caminho 🧭', body: `${c.name ? `${c.name}, que` : 'Que'} tal marcar uma pérola nos seus Logs hoje?` }),
  (c) => ({ title: 'Seu porto seguro está aqui ⚓', body: `Se o dia pesou${c.name ? `, ${c.name}` : ''}, o Porto está aberto para conversar.` }),
  (c) => ({ title: `Sexta chegou${c.name ? `, ${c.name}` : ''} 🌅`, body: 'Como você termina esta semana? Um diário por voz de 1 minuto já vale.' }),
  (c) => ({ title: 'Sábado sem pressa 🌿', body: 'Um momento só seu: como está o seu mar hoje?' }),
];

export function dailyMessage(date: Date, c: PersonalContext, dayIndex: number) {
  const recentHardMood = c.lastMood && c.lastMood !== 'calmo' && Date.now() - c.lastMoodAt < 36 * 3600_000;
  if (dayIndex === 0 && recentHardMood) {
    return { title: `${hi(c.name)}, como você está hoje? 💙`, body: 'Passando para saber de você. Hoje pode ser mais leve — a Nórica está aqui.' };
  }
  if (dayIndex === 0 && c.streak >= 2) {
    return { title: `🔥 ${c.streak} dias seguidos${c.name ? `, ${c.name}` : ''}!`, body: `Marque uma pérola hoje e chegue a ${c.streak + 1} dias cuidando de você.` };
  }
  return POOL[date.getDay()](c);
}

const DAILY_DAYS = 14; // agenda 2 semanas à frente; reagenda a cada abertura do app
const NATIVE_TIMEOUT = 8000;

/** Chamada nativa com prazo: se o celular não responder, o app não fica "carregando para sempre". */
function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`tempo esgotado: ${stage}`)), ms)),
  ]);
}

async function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

async function ensureChannel(ln: any) {
  await withTimeout(
    ln.createChannel({
      id: CHANNEL_ID,
      name: 'Lembretes da Nórica',
      description: 'Lembrete diário, resumo da semana e avisos gentis',
      importance: 3,
      visibility: 0, // tela bloqueada: mostra só que há uma notificação da Nórica
    }),
    NATIVE_TIMEOUT,
    'canal',
  ).catch(() => {});
}

async function cancelIds(ids: number[]) {
  const ln = await plugin();
  if (!ln || !ids.length) return;
  await withTimeout(ln.cancel({ notifications: ids.map((id) => ({ id })) }), NATIVE_TIMEOUT, 'cancelar').catch(() => {});
}

const dailyIds = () => Array.from({ length: DAILY_DAYS }, (_, i) => BASE_ID + i + 1);

/** Agenda os próximos 14 lembretes diários, cada um com uma mensagem personalizada. */
async function scheduleDaily(ln: any, hour: number, minute: number) {
  await cancelIds(dailyIds());
  const ctx = personalContext();
  const now = new Date();
  const notifications = [];
  for (let i = 0, d = 0; notifications.length < DAILY_DAYS && d < DAILY_DAYS + 1; d++) {
    const at = new Date(now);
    at.setDate(now.getDate() + d);
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= now.getTime() + 30_000) continue; // horário de hoje já passou
    const msg = dailyMessage(at, ctx, i);
    notifications.push({
      id: BASE_ID + notifications.length + 1,
      title: msg.title,
      body: msg.body,
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_norica',
      iconColor: '#34d399',
      extra: { route: '/' },
      schedule: { at, allowWhileIdle: true },
    });
    i++;
  }
  await withTimeout(ln.schedule({ notifications }), NATIVE_TIMEOUT, 'agendar');
}

export type ReminderStage = 'permissão' | 'esperando resposta' | 'canal' | 'agendar' | 'pronto';

/** Pede a permissão só quando o Android ainda pode mostrar a janela. Se já foi negada, não trava esperando. */
async function ensurePermission(ln: any, onStage?: (s: ReminderStage) => void): Promise<boolean> {
  const perm = await withTimeout(ln.checkPermissions(), NATIVE_TIMEOUT, 'checar permissão') as { display: string };
  if (perm.display === 'granted') return true;
  if (perm.display === 'denied') return false; // o Android não mostra a janela de novo: só pelas Configurações
  onStage?.('esperando resposta');
  const asked = await withTimeout(ln.requestPermissions(), 30_000, 'pedir permissão') as { display: string };
  return asked.display === 'granted';
}

/** Liga (ou muda o horário do) lembrete. Pede a permissão de notificação se precisar. */
export async function enableReminder(hour: number, minute: number, onStage?: (s: ReminderStage) => void): Promise<ReminderResult> {
  const ln = await withTimeout(plugin(), NATIVE_TIMEOUT, 'carregar plugin').catch(() => null);
  if (!ln) {
    save({ ...getReminder(), enabled: false, hour, minute });
    return Capacitor.isNativePlatform() ? 'error' : 'unsupported';
  }
  let stage: ReminderStage = 'permissão';
  try {
    onStage?.(stage);
    if (!(await ensurePermission(ln, onStage))) {
      save({ ...getReminder(), enabled: false, hour, minute });
      return 'denied';
    }
    stage = 'canal';
    onStage?.(stage);
    await ensureChannel(ln);
    stage = 'agendar';
    onStage?.(stage);
    // Guarda a escolha antes de agendar: mesmo se o agendamento demorar, o app reagenda na próxima abertura.
    save({ ...getReminder(), enabled: true, hour, minute });
    await scheduleDaily(ln, hour, minute);
    onStage?.('pronto');
    refreshEngagementNotifications().catch(() => {}); // os outros avisos em segundo plano
    return 'ok';
  } catch (e) {
    console.error('Lembrete:', e);
    reportError(e, `lembrete:${stage}`);
    return 'error';
  }
}

/** Notificação de teste em 5 segundos (para conferir que está tudo certo). */
export async function sendTestNotification(): Promise<ReminderResult> {
  const ln = await plugin().catch(() => null);
  if (!ln) return 'unsupported';
  try {
    if (!(await ensurePermission(ln))) return 'denied';
    await ensureChannel(ln);
    const ctx = personalContext();
    await withTimeout(ln.schedule({
      notifications: [{
        id: 7399,
        title: `${hi(ctx.name)}! Teste da Nórica ⚓`,
        body: 'Se você está vendo isto, os lembretes estão funcionando.',
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_norica',
        iconColor: '#34d399',
        extra: { route: '/' },
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      }],
    }), NATIVE_TIMEOUT, 'teste');
    return 'ok';
  } catch (e) {
    reportError(e, 'lembrete:teste');
    return 'error';
  }
}

export async function disableReminder() {
  await cancelIds(dailyIds());
  save({ ...getReminder(), enabled: false });
}

/** Ao tocar na notificação, abre a tela indicada (Início, Porto, Logs ou o resumo no Farol). */
export async function listenReminderTaps(navigate: (route: string) => void) {
  const ln = await plugin();
  if (!ln) return () => {};
  const handle = await ln.addListener('localNotificationActionPerformed', (event) => {
    const route = (event.notification?.extra as { route?: string } | undefined)?.route ?? '/';
    navigate(route);
  });
  return () => handle.remove();
}

/** Guarda o primeiro nome e o último humor no aparelho para personalizar as mensagens. */
export function rememberForNotifications(data: { name?: string | null; mood?: string | null }) {
  try {
    if (data.name) localStorage.setItem('norica-first-name', data.name);
    if (data.mood) localStorage.setItem('norica-last-mood', JSON.stringify({ mood: data.mood, at: Date.now() }));
  } catch (_e) {}
}

// Depois de uma conversa difícil, um "como você está?" gentil no dia seguinte, às 10h.
// Só agenda se a pessoa já permitiu notificações (nunca pede permissão no meio de uma crise).
// O texto é discreto de propósito: aparece na tela bloqueada.
const CHECKIN_ID = 7200;
export async function scheduleCheckIn(): Promise<boolean> {
  const ln = await grantedPlugin();
  if (!ln) return false;
  try {
    const at = new Date();
    at.setDate(at.getDate() + 1);
    at.setHours(10, 0, 0, 0);
    await cancelIds([CHECKIN_ID]);
    await withTimeout(ln.schedule({
      notifications: [{
        id: CHECKIN_ID,
        title: 'Como você está hoje? 💚',
        body: 'Passando só para saber de você. O Porto está aberto quando quiser.',
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_norica',
        iconColor: '#34d399',
        extra: { route: '/porto/' },
        schedule: { at, allowWhileIdle: true },
      }],
    }), NATIVE_TIMEOUT, 'check-in');
    return true;
  } catch (_e) {
    return false;
  }
}


// ---------------------------------------------------------------------
// Avisos para voltar todo dia (só agendam se a pessoa já permitiu notificações)
// ---------------------------------------------------------------------

async function grantedPlugin() {
  const ln = await plugin().catch(() => null);
  if (!ln) return null;
  try {
    const perm = await withTimeout(ln.checkPermissions(), NATIVE_TIMEOUT, 'checar permissão');
    if (perm.display !== 'granted') return null;
    await ensureChannel(ln);
    return ln;
  } catch (_e) {
    return null;
  }
}

async function scheduleOne(id: number, title: string, body: string, route: string, schedule: Record<string, unknown>) {
  const ln = await grantedPlugin();
  if (!ln) return false;
  await cancelIds([id]);
  await withTimeout(ln.schedule({
    notifications: [{ id, title, body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_norica', iconColor: '#34d399', extra: { route }, schedule: schedule as any }],
  }), NATIVE_TIMEOUT, 'agendar aviso').catch((e) => reportError(e, 'lembrete:aviso'));
  return true;
}

const cancelOne = (id: number) => cancelIds([id]);

/** Próximo domingo às 19h (ou hoje, se ainda não passou). */
function nextSunday19(weeksAhead = 0) {
  const at = new Date();
  at.setDate(at.getDate() + ((7 - at.getDay()) % 7) + weeksAhead * 7);
  at.setHours(19, 0, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 7);
  return at;
}

/** Domingo, 19h: "seu resumo da semana chegou" (abre o Farol direto no resumo). */
export async function scheduleWeeklySummary() {
  if (!getReminder().weekly) return cancelIds([WEEKLY_ID, WEEKLY_ID + 3]);
  const name = personalContext().name;
  await scheduleOne(WEEKLY_ID, `${name ? `${name}, seu` : 'Seu'} resumo da semana chegou 🌊`, 'A Nórica escreveu como foi a sua semana. Vem ver?', '/farol/?resumo=1',
    { at: nextSunday19(0), allowWhileIdle: true });
  await scheduleOne(WEEKLY_ID + 3, `${name ? `${name}, seu` : 'Seu'} resumo da semana chegou 🌊`, 'A Nórica escreveu como foi a sua semana. Vem ver?', '/farol/?resumo=1',
    { at: nextSunday19(1), allowWhileIdle: true });
}

/** Sequência dos Logs: amanhã às 19h30 lembra de manter a ofensiva (só a partir de 2 dias seguidos). */
export async function scheduleStreak(streak: number) {
  if (!getReminder().streak || streak < 2) return cancelOne(STREAK_ID);
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(19, 30, 0, 0);
  const name = personalContext().name;
  await scheduleOne(STREAK_ID, `🔥 ${streak} dias seguidos${name ? `, ${name}` : ''}`, 'Marque uma pérola hoje nos Logs para manter sua sequência.', '/log/',
    { at, allowWhileIdle: true });
}

/** Cada vez que o app abre, empurra para daqui a 3 dias um "sentimos sua falta". */
export async function scheduleComeback() {
  if (!getReminder().comeback) return cancelOne(COMEBACK_ID);
  const at = new Date();
  at.setDate(at.getDate() + 3);
  at.setHours(19, 0, 0, 0);
  const name = personalContext().name;
  await scheduleOne(COMEBACK_ID, `${name ? `${name}, como` : 'Como'} está o seu mar? 💙`, 'Faz uns dias que a gente não conversa. Um minuto aqui já ajuda.', '/',
    { at, allowWhileIdle: true });
}

/** Liga/desliga um tipo de aviso e reagenda. */
export async function setNotificationPref(key: 'weekly' | 'streak' | 'comeback', value: boolean) {
  save({ ...getReminder(), [key]: value });
  if (key === 'weekly') await scheduleWeeklySummary();
  if (key === 'comeback') await scheduleComeback();
  if (key === 'streak' && !value) await cancelOne(STREAK_ID);
}

/** Ao abrir o app: mantém os avisos em dia (sem pedir permissão). */
export async function refreshEngagementNotifications() {
  // Lembrete diário: reagenda as próximas 2 semanas com mensagens atualizadas.
  const r = getReminder();
  if (r.enabled) {
    const ln = await grantedPlugin();
    if (ln) await scheduleDaily(ln, r.hour, r.minute).catch((e) => reportError(e, 'lembrete:diario'));
  }
  await scheduleWeeklySummary().catch(() => {});
  await scheduleComeback().catch(() => {});
}

// Convite na Início para ligar o lembrete (aparece uma vez, a partir da 2ª visita).
const INVITE_KEY = 'norica-reminder-invite';
const OPENS_KEY = 'norica-open-count';
export function countAppOpen() {
  try { localStorage.setItem(OPENS_KEY, String((Number(localStorage.getItem(OPENS_KEY)) || 0) + 1)); } catch (_e) {}
}
export function shouldInviteReminder(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    if (localStorage.getItem(INVITE_KEY)) return false;
    if (getReminder().enabled) return false;
    return (Number(localStorage.getItem(OPENS_KEY)) || 0) >= 2;
  } catch (_e) {
    return false;
  }
}
export function dismissReminderInvite() {
  try { localStorage.setItem(INVITE_KEY, new Date().toISOString()); } catch (_e) {}
}

// ---------------------------------------------------------------------
// Avisos avulsos (trilhas, cartas para o futuro, consulta da terapia)
// Só agendam se a pessoa já permitiu notificações; nunca pedem permissão sozinhos.
// ---------------------------------------------------------------------

export type LocalNotice = { id: number; at: Date; title: string; body: string; route: string };

export async function scheduleNotices(list: LocalNotice[]): Promise<boolean> {
  const future = list.filter((n) => n.at.getTime() > Date.now() + 30_000);
  if (!future.length) return false;
  const ln = await grantedPlugin();
  if (!ln) return false;
  await cancelIds(future.map((n) => n.id));
  try {
    await withTimeout(ln.schedule({
      notifications: future.map((n) => ({
        id: n.id, title: n.title, body: n.body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_norica', iconColor: '#34d399',
        extra: { route: n.route }, schedule: { at: n.at, allowWhileIdle: true },
      })),
    }), NATIVE_TIMEOUT, 'agendar avisos');
    return true;
  } catch (e) {
    reportError(e, 'lembrete:avisos');
    return false;
  }
}

export const cancelNotices = (ids: number[]) => cancelIds(ids);
