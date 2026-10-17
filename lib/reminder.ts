"use client";

// Notificações da Nórica (lembrete diário, resumo de domingo, sequência, "sentimos sua falta").
// Notificações locais: agendadas no próprio celular, funcionam sem internet e sem servidor.
// As mensagens são personalizadas (nome, sequência, último humor) e reagendadas a cada abertura.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { reportError } from './error-report';
import { getPhase } from './fase';

export type ReminderSettings = {
  enabled: boolean; // lembrete diário
  hour: number;
  minute: number;
  weekly: boolean; // domingo 19h: resumo da semana pronto
  streak: boolean; // sequência dos Logs (não perder a ofensiva)
  comeback: boolean; // depois de 3 dias sem abrir o app
  evening: boolean; // 21h: "como foi o seu dia?" com respostas direto na notificação
  water: boolean; // 10h e 15h: lembrete leve de água
  sun: boolean; // 9h30: lembrete de 10 minutos de luz do dia
  movement: boolean; // 16h: pausa de movimento de 2 minutos
};
export type ReminderResult = 'ok' | 'denied' | 'unsupported' | 'error';

const KEY = 'norica-reminder';
const CHANNEL_ID = 'lembrete-diario';
const BASE_ID = 7100; // ids 7101..7114: próximos 14 lembretes diários
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 20, minute: 0, weekly: true, streak: true, comeback: true, evening: true, water: false, sun: false, movement: false };
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

const PHASE_POOL = [
  'Passando só para lembrar: um dia de cada vez já é muito.',
  'Hoje não precisa render. Se der, beba uma água e respire fundo.',
  'Você não está sozinho nessa fase. A Nórica está aqui quando quiser.',
  'Seja gentil com você hoje. O resto pode esperar.',
];
export function dailyMessage(date: Date, c: PersonalContext, dayIndex: number) {
  // Modo fase difícil: lembretes mais leves, sem sequência nem metas.
  if (getPhase()) return { title: `${hi(c.name)}, como você está? 💙`, body: PHASE_POOL[(date.getDate() + dayIndex) % PHASE_POOL.length] };
  const recentHardMood = c.lastMood && c.lastMood !== 'calmo' && Date.now() - c.lastMoodAt < 36 * 3600_000;
  if (dayIndex === 0 && recentHardMood) {
    return { title: `${hi(c.name)}, como você está hoje? 💙`, body: 'Passando para saber de você. Hoje pode ser mais leve — a Nórica está aqui.' };
  }
  if (dayIndex === 0 && c.streak >= 2) {
    return { title: `🔥 ${c.streak} dias seguidos${c.name ? `, ${c.name}` : ''}!`, body: `Se der, marque uma pérola hoje. Se não der, tudo bem — cuidar também é descansar.` };
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

// ATENÇÃO: nunca devolver o plugin "solto" de uma função async (return LocalNotifications).
// O plugin do Capacitor responde a qualquer propriedade, inclusive "then"; a Promise acha que
// ele é outra Promise, chama LocalNotifications.then() no Android e fica esperando para sempre.
// Era isso que deixava o lembrete "carregando infinitamente" e nenhum aviso era agendado.
// Por isso o plugin sempre viaja dentro de uma caixinha: { ln }.
type LN = typeof import('@capacitor/local-notifications').LocalNotifications;
async function plugin(): Promise<{ ln: LN } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return { ln: LocalNotifications };
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
  const ln = (await plugin().catch(() => null))?.ln;
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
  const ln = (await withTimeout(plugin(), NATIVE_TIMEOUT, 'carregar plugin').catch(() => null))?.ln;
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
  const ln = (await plugin().catch(() => null))?.ln;
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
export async function listenReminderTaps(navigate: (route: string) => void, onCheckin?: (answer: 'bem' | 'mais' | 'dificil') => void) {
  const ln = (await plugin().catch(() => null))?.ln;
  if (!ln) return () => {};
  const handle = await ln.addListener('localNotificationActionPerformed', (event) => {
    const extra = (event.notification?.extra ?? {}) as { route?: string; kind?: string };
    const action = event.actionId as string;
    // Respondeu o check-in da noite direto na notificação
    if (extra.kind === 'checkin' && (action === 'bem' || action === 'mais' || action === 'dificil')) {
      onCheckin?.(action);
      navigate(action === 'dificil' ? '/porto/?humor=agitado' : `/?checkin=${action}`);
      return;
    }
    navigate(extra.route ?? '/');
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
  const ln = (await grantedPlugin())?.ln;
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

async function grantedPlugin(): Promise<{ ln: LN } | null> {
  const ln = (await plugin().catch(() => null))?.ln;
  if (!ln) return null;
  try {
    const perm = await withTimeout(ln.checkPermissions(), NATIVE_TIMEOUT, 'checar permissão');
    if (perm.display !== 'granted') return null;
    await ensureChannel(ln);
    return { ln };
  } catch (_e) {
    return null;
  }
}

async function scheduleOne(id: number, title: string, body: string, route: string, schedule: Record<string, unknown>) {
  const ln = (await grantedPlugin())?.ln;
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
  // Fase difícil: nada de cobrar sequência.
  if (!getReminder().streak || streak < 2 || getPhase()) return cancelOne(STREAK_ID);
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(19, 30, 0, 0);
  const name = personalContext().name;
  await scheduleOne(STREAK_ID, `🔥 ${streak} dias seguidos${name ? `, ${name}` : ''}`, 'Uma pérola pequena hoje já mantém a sequência. E se não der, tudo bem.', '/log/',
    { at, allowWhileIdle: true });
}

/** Cada vez que o app abre, empurra para daqui a 3 dias um "sentimos sua falta". */
export async function scheduleComeback() {
  if (!getReminder().comeback || getPhase()) return cancelOne(COMEBACK_ID);
  const at = new Date();
  at.setDate(at.getDate() + 3);
  at.setHours(19, 0, 0, 0);
  const name = personalContext().name;
  await scheduleOne(COMEBACK_ID, `${name ? `${name}, como` : 'Como'} está o seu mar? 💙`, 'Faz uns dias que a gente não conversa. Um minuto aqui já ajuda.', '/',
    { at, allowWhileIdle: true });
}

/** Liga/desliga um tipo de aviso e reagenda. */
export type NotificationPref = 'weekly' | 'streak' | 'comeback' | 'evening' | 'water' | 'sun' | 'movement';
export async function setNotificationPref(key: NotificationPref, value: boolean) {
  save({ ...getReminder(), [key]: value });
  if (key === 'weekly') await scheduleWeeklySummary();
  if (key === 'comeback') await scheduleComeback();
  if (key === 'streak' && !value) await cancelOne(STREAK_ID);
  if (key === 'evening') await scheduleEveningCheckins();
  if (key === 'water' || key === 'sun' || key === 'movement') await scheduleCareNudges();
}

/** Ao abrir o app: mantém os avisos em dia (sem pedir permissão). */
export async function refreshEngagementNotifications() {
  // Lembrete diário: reagenda as próximas 2 semanas com mensagens atualizadas.
  const r = getReminder();
  if (r.enabled) {
    const ln = (await grantedPlugin())?.ln;
    if (ln) await scheduleDaily(ln, r.hour, r.minute).catch((e) => reportError(e, 'lembrete:diario'));
  }
  await scheduleWeeklySummary().catch(() => {});
  await scheduleComeback().catch(() => {});
  await scheduleEveningCheckins().catch(() => {});
  await scheduleCareNudges().catch(() => {});
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
  const ln = (await grantedPlugin())?.ln;
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

/** Situação das notificações no celular (para mostrar na tela e ajudar a resolver). */
export async function notificationStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported' | 'error'> {
  const np = notifyPlugin();
  if (np) {
    try {
      const st = await withTimeout(np.status(), NATIVE_TIMEOUT, 'status nativo');
      if (st.enabled) return 'granted';
      if (st.sdk < 33) return 'denied'; // Android 12 ou antes: não há janela, só as Configurações
    } catch (_e) {}
  }
  const ln = (await withTimeout(plugin(), NATIVE_TIMEOUT, 'carregar plugin').catch(() => null))?.ln;
  if (!ln) return Capacitor.isNativePlatform() ? 'error' : 'unsupported';
  try {
    const p = await withTimeout(ln.checkPermissions(), NATIVE_TIMEOUT, 'checar permissão') as { display: string };
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  } catch (e) {
    reportError(e, 'lembrete:status');
    return 'error';
  }
}

// ---------------------------------------------------------------------
// Permitir notificações direto no app
// ---------------------------------------------------------------------

type NoricaNotifyPlugin = { status(): Promise<{ enabled: boolean; sdk: number }>; openSettings(): Promise<void>; firebase?(): Promise<{ ready: boolean }>; setFlameWidget?(o: { count: string; title: string; sub: string; lit: boolean }): Promise<void> };
let nativeNotify: NoricaNotifyPlugin | null = null;
function notifyPlugin(): NoricaNotifyPlugin | null {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('NoricaNotify')) return null;
  if (!nativeNotify) nativeNotify = registerPlugin<NoricaNotifyPlugin>('NoricaNotify');
  return nativeNotify;
}

/** Atualiza o widget "Foguinho" da tela inicial (só no celular). */
export async function setFlameWidget(o: { count: string; title: string; sub: string; lit: boolean }) {
  const p = notifyPlugin();
  if (!p?.setFlameWidget) return;
  try { await withTimeout(p.setFlameWidget(o), NATIVE_TIMEOUT, 'widget foguinho'); } catch (_e) {}
}

/** true quando o app foi montado com o Firebase (google-services.json). Sem ele, o push fica desligado. */
export async function firebaseReady(): Promise<boolean> {
  const p = notifyPlugin();
  if (!p?.firebase) return false;
  try { return !!(await withTimeout(p.firebase(), NATIVE_TIMEOUT, 'firebase')).ready; } catch (_e) { return false; }
}

/** Abre a tela de notificações da Nórica nas Configurações do Android. */
export async function openNotificationSettings(): Promise<boolean> {
  const p = notifyPlugin();
  if (!p) return false;
  try { await withTimeout(p.openSettings(), NATIVE_TIMEOUT, 'abrir configurações'); return true; } catch (e) { reportError(e, 'lembrete:configuracoes'); return false; }
}

/**
 * Um toque para permitir: se o Android ainda pode perguntar, mostra a janela dele;
 * se já foi negado antes, abre direto a tela de notificações do app.
 */
export async function askNotificationPermission(): Promise<'granted' | 'asked' | 'settings' | 'unsupported' | 'error'> {
  const status = await notificationStatus();
  if (status === 'granted') return 'granted';
  if (status === 'unsupported') return 'unsupported';
  if (status === 'prompt') {
    const ln = (await withTimeout(plugin(), NATIVE_TIMEOUT, 'carregar plugin').catch(() => null))?.ln;
    if (ln) {
      try {
        const r = await withTimeout(ln.requestPermissions(), 30_000, 'pedir permissão') as { display: string };
        if (r.display === 'granted') return 'granted';
      } catch (e) {
        reportError(e, 'lembrete:pedir');
      }
    }
  }
  return (await openNotificationSettings()) ? 'settings' : 'error';
}


// ---------------------------------------------------------------------
// Check-in da noite (21h): "Como foi o seu dia?" com 3 respostas direto na notificação
// ---------------------------------------------------------------------

const EVENING_BASE = 7150; // 7151..7164: próximas 2 semanas
const EVENING_DAYS = 14;
export const CHECKIN_ACTIONS = { bem: 'calmo', mais: 'ansioso', dificil: 'agitado' } as const;
let actionTypesReady = false;

async function ensureCheckinActions(ln: LN) {
  if (actionTypesReady) return;
  await withTimeout(ln.registerActionTypes({
    types: [{
      id: 'CHECKIN',
      actions: [
        { id: 'bem', title: '🙂 Bem' },
        { id: 'mais', title: '😐 Mais ou menos' },
        { id: 'dificil', title: '😣 Difícil' },
      ],
    }],
  }), NATIVE_TIMEOUT, 'tipos de ação').catch(() => {});
  actionTypesReady = true;
}

const EVENING_TEXTS = [
  'Como foi o seu dia? Um toque já responde.',
  'Antes de dormir: como você está?',
  'Fim de dia. Como ficou o seu mar?',
  'Passando para saber de você hoje.',
];

function markedMoodToday(): boolean {
  try {
    const last = JSON.parse(localStorage.getItem('norica-last-mood') || 'null');
    return !!last?.at && new Date(last.at).toDateString() === new Date().toDateString();
  } catch (_e) {
    return false;
  }
}

export async function scheduleEveningCheckins() {
  const ids = Array.from({ length: EVENING_DAYS }, (_, i) => EVENING_BASE + i + 1);
  await cancelIds(ids);
  if (!getReminder().evening) return;
  const ln = (await grantedPlugin())?.ln;
  if (!ln) return;
  await ensureCheckinActions(ln);
  const name = personalContext().name;
  const notifications = [];
  for (let d = 0; d < EVENING_DAYS; d++) {
    const at = new Date();
    at.setDate(at.getDate() + d);
    at.setHours(21, 0, 0, 0);
    if (at.getTime() <= Date.now() + 30_000) continue;
    if (d === 0 && markedMoodToday()) continue; // já contou como está hoje
    notifications.push({
      id: EVENING_BASE + d + 1,
      title: name ? `${name}, como foi o seu dia? 🌙` : 'Como foi o seu dia? 🌙',
      body: EVENING_TEXTS[d % EVENING_TEXTS.length],
      channelId: CHANNEL_ID, smallIcon: 'ic_stat_norica', iconColor: '#34d399',
      actionTypeId: 'CHECKIN',
      extra: { route: '/', kind: 'checkin' },
      schedule: { at, allowWhileIdle: true },
    });
  }
  if (notifications.length) await withTimeout(ln.schedule({ notifications }), NATIVE_TIMEOUT, 'check-in').catch((e) => reportError(e, 'lembrete:checkin'));
}

/** Depois de um dia difícil: amanhã às 9h, um bom-dia gentil. */
export async function scheduleMorningAfter() {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(9, 0, 0, 0);
  const name = personalContext().name;
  await scheduleNotices([{ id: 7203, at, title: name ? `Bom dia, ${name} 🌤️` : 'Bom dia 🌤️', body: 'Ontem foi pesado. Hoje pode ser mais leve — e a Nórica está aqui se precisar.', route: '/' }]);
}

// ---------------------------------------------------------------------
// Cuidados do corpo (opcionais): água, sol e movimento
// ---------------------------------------------------------------------

const CARE = [
  { key: 'water' as const, id: 7311, h: 10, m: 0, title: 'Um copo de água? 💧', body: 'Seu corpo agradece. Dá para marcar a pérola nos Logs.', route: '/log/' },
  { key: 'water' as const, id: 7312, h: 15, m: 0, title: 'Hora de um gole de água 💧', body: 'Pequenos cuidados somam.', route: '/log/' },
  { key: 'sun' as const, id: 7313, h: 9, m: 30, title: '10 minutos de luz do dia ☀️', body: 'Luz da manhã ajuda o humor e o sono de hoje à noite.', route: '/log/' },
  { key: 'movement' as const, id: 7314, h: 16, m: 0, title: 'Pausa de 2 minutos 🧘', body: 'Levanta, alonga o pescoço e os ombros. Tem um guia na Nórica.', route: '/movimento/' },
];

export async function scheduleCareNudges() {
  const prefs = getReminder();
  await cancelIds(CARE.map((c) => c.id));
  const active = CARE.filter((c) => prefs[c.key]);
  if (!active.length) return;
  const ln = (await grantedPlugin())?.ln;
  if (!ln) return;
  await withTimeout(ln.schedule({
    notifications: active.map((c) => ({
      id: c.id, title: c.title, body: c.body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_norica', iconColor: '#34d399',
      extra: { route: c.route }, schedule: { on: { hour: c.h, minute: c.m }, allowWhileIdle: true },
    })),
  }), NATIVE_TIMEOUT, 'cuidados').catch((e) => reportError(e, 'lembrete:cuidados'));
}
