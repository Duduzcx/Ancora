"use client";

// Lembrete diário ("Como está o seu mar hoje?").
// Notificação local: agendada no próprio celular, funciona sem internet e sem servidor.
// Uma mensagem diferente para cada dia da semana, no horário que a pessoa escolher.

import { Capacitor } from '@capacitor/core';

export type ReminderSettings = { enabled: boolean; hour: number; minute: number };
export type ReminderResult = 'ok' | 'denied' | 'unsupported' | 'error';

const KEY = 'norica-reminder';
const CHANNEL_ID = 'lembrete-diario';
const BASE_ID = 7100; // ids 7101..7107 (um por dia da semana)
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 20, minute: 0 };

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
    save({ enabled: false, hour, minute });
    return 'unsupported';
  }
  try {
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') {
      save({ enabled: false, hour, minute });
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
    save({ enabled: true, hour, minute });
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
