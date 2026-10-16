"use client";

// Lembrete diário ("Como está o seu mar hoje?").
// Notificação local: agendada no próprio celular, funciona sem internet e sem servidor.
// Uma mensagem diferente para cada dia da semana, no horário que a pessoa escolher.

import { Capacitor } from '@capacitor/core';

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
const BASE_ID = 7100; // ids 7101..7107 (um por dia da semana)
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 20, minute: 0, weekly: true, streak: true, comeback: true };
const WEEKLY_ID = 7301;
const STREAK_ID = 7302;
const COMEBACK_ID = 7303;

// weekday: 1 = domingo … 7 = sábado
const MESSAGES: { title: string; body: string }[] = [
  { title: 'Domingo de maré mansa? 🌊', body: 'Tire um minuto para ver como está o seu mar hoje.' },
  { title: 'Como está o seu mar hoje? ⚓', body: 'Um toque para registrar. A Nórica acompanha você na semana.' },
  { title: 'Pausa de um minuto 🫧', body: 'Respire fundo e conte para a Nórica como foi o dia.' },
  { title: 'Meio da semana, meio do caminho 🧭', body: 'Que tal marcar uma pérola nos seus Logs hoje?' },
  { title: 'Seu porto seguro está aqui ⚓', body: 'Se o dia pesou, o Porto está aberto para conversar.' },
  { title: 'Sexta chegou 🌅', body: 'Como você termina esta semana? Registre seu mar.' },
  { title: 'Sábado sem pressa 🌿', body: 'Um momento só seu: como está o seu mar hoje?' },
];

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

async function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

async function cancelAll() {
  const ln = await plugin();
  if (!ln) return;
  await ln.cancel({ notifications: MESSAGES.map((_, i) => ({ id: BASE_ID + i + 1 })) }).catch(() => {});
}

/** Liga (ou muda o horário do) lembrete. Pede a permissão de notificação se precisar. */
export async function enableReminder(hour: number, minute: number): Promise<ReminderResult> {
  const ln = await plugin();
  if (!ln) {
    save({ ...getReminder(), enabled: false, hour, minute });
    return 'unsupported';
  }
  try {
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') {
      save({ ...getReminder(), enabled: false, hour, minute });
      return 'denied';
    }
    await ln.createChannel({
      id: CHANNEL_ID,
      name: 'Lembrete diário',
      description: 'Um convite por dia para registrar como está o seu mar',
      importance: 3,
      visibility: 1,
    }).catch(() => {});
    await cancelAll();
    await ln.schedule({
      notifications: MESSAGES.map((m, i) => ({
        id: BASE_ID + i + 1,
        title: m.title,
        body: m.body,
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_norica',
        iconColor: '#34d399',
        extra: { route: '/' },
        schedule: { on: { weekday: i + 1, hour, minute }, allowWhileIdle: true },
      })),
    });
    save({ ...getReminder(), enabled: true, hour, minute });
    await refreshEngagementNotifications();
    return 'ok';
  } catch (e) {
    console.error('Lembrete:', e);
    return 'error';
  }
}

export async function disableReminder() {
  await cancelAll();
  save({ ...getReminder(), enabled: false });
}

/** Ao tocar na notificação, abre a Início (onde ficam os cards "Como está seu mar?"). */
export async function listenReminderTaps(navigate: (route: string) => void) {
  const ln = await plugin();
  if (!ln) return () => {};
  const handle = await ln.addListener('localNotificationActionPerformed', (event) => {
    const route = (event.notification?.extra as { route?: string } | undefined)?.route ?? '/';
    navigate(route);
  });
  return () => handle.remove();
}

// Depois de uma conversa difícil, um "como você está?" gentil no dia seguinte, às 10h.
// Só agenda se a pessoa já permitiu notificações (nunca pede permissão no meio de uma crise).
// O texto é discreto de propósito: aparece na tela bloqueada.
const CHECKIN_ID = 7200;
export async function scheduleCheckIn(): Promise<boolean> {
  const ln = await plugin();
  if (!ln) return false;
  try {
    const perm = await ln.checkPermissions();
    if (perm.display !== 'granted') return false;
    await ln.createChannel({ id: CHANNEL_ID, name: 'Lembrete diário', importance: 3, visibility: 1 }).catch(() => {});
    const at = new Date();
    at.setDate(at.getDate() + 1);
    at.setHours(10, 0, 0, 0);
    await ln.cancel({ notifications: [{ id: CHECKIN_ID }] }).catch(() => {});
    await ln.schedule({
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
    });
    return true;
  } catch (_e) {
    return false;
  }
}


// ---------------------------------------------------------------------
// Avisos para voltar todo dia (só agendam se a pessoa já permitiu notificações)
// ---------------------------------------------------------------------

async function grantedPlugin() {
  const ln = await plugin();
  if (!ln) return null;
  try {
    const perm = await ln.checkPermissions();
    if (perm.display !== 'granted') return null;
    await ln.createChannel({ id: CHANNEL_ID, name: 'Lembrete diário', importance: 3, visibility: 1 }).catch(() => {});
    return ln;
  } catch (_e) {
    return null;
  }
}

async function scheduleOne(id: number, title: string, body: string, route: string, schedule: Record<string, unknown>) {
  const ln = await grantedPlugin();
  if (!ln) return false;
  await ln.cancel({ notifications: [{ id }] }).catch(() => {});
  await ln.schedule({
    notifications: [{ id, title, body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_norica', iconColor: '#34d399', extra: { route }, schedule: schedule as any }],
  });
  return true;
}

async function cancelOne(id: number) {
  const ln = await plugin();
  if (ln) await ln.cancel({ notifications: [{ id }] }).catch(() => {});
}

/** Domingo, 19h: "seu resumo da semana chegou" (abre o Farol direto no resumo). */
export async function scheduleWeeklySummary() {
  if (!getReminder().weekly) return cancelOne(WEEKLY_ID);
  await scheduleOne(WEEKLY_ID, 'Seu resumo da semana chegou 🌊', 'A Nórica escreveu como foi a sua semana. Vem ver?', '/farol/?resumo=1',
    { on: { weekday: 1, hour: 19, minute: 0 }, allowWhileIdle: true });
}

/** Sequência dos Logs: amanhã às 19h30 lembra de manter a ofensiva (só a partir de 2 dias seguidos). */
export async function scheduleStreak(streak: number) {
  if (!getReminder().streak || streak < 2) return cancelOne(STREAK_ID);
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(19, 30, 0, 0);
  await scheduleOne(STREAK_ID, `🔥 ${streak} dias seguidos cuidando de você`, 'Marque uma pérola hoje nos Logs para manter sua sequência.', '/log/',
    { at, allowWhileIdle: true });
}

/** Cada vez que o app abre, empurra para daqui a 3 dias um "sentimos sua falta". */
export async function scheduleComeback() {
  if (!getReminder().comeback) return cancelOne(COMEBACK_ID);
  const at = new Date();
  at.setDate(at.getDate() + 3);
  at.setHours(19, 0, 0, 0);
  await scheduleOne(COMEBACK_ID, 'Como está o seu mar? 💙', 'Faz uns dias que a gente não conversa. Um minuto aqui já ajuda.', '/',
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
