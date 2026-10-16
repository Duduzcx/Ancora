"use client";

// Notificações em tempo real (Firebase Cloud Messaging): mensagens do chat, carinhos
// do foguinho e convites aceitos chegam na hora, mesmo com o app fechado.
// Só liga quando o app foi montado com o google-services.json — sem ele, não faz nada
// (e o resto do app segue igual, com as notificações locais de sempre).

import { Capacitor } from '@capacitor/core';
import { firebaseReady, notificationStatus } from '@/lib/reminder';
import { reportError } from '@/lib/error-report';

const TOKEN_KEY = 'norica-push-token';
let started = false;

// IMPORTANTE: o plugin do Capacitor é um "proxy" que parece uma Promise.
// Nunca devolver ele de uma função async: guardamos dentro de um objeto { pn }.
async function load() {
  const mod = await import('@capacitor/push-notifications');
  return { pn: mod.PushNotifications };
}

/** Liga o push para a pessoa logada. ask=true pode mostrar a janela de permissão. */
export async function initPush(navigate: (route: string) => void, ask = false): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    if (!(await firebaseReady())) return false;
    const status = await notificationStatus();
    if (status !== 'granted' && !(ask && status === 'prompt')) return false;
    const { pn } = await load();
    if (status !== 'granted') {
      const r = await pn.requestPermissions();
      if (r.receive !== 'granted') return false;
    }
    if (!started) {
      started = true;
      await pn.createChannel({ id: 'amigos', name: 'Amigos', description: 'Mensagens e carinhos dos seus amigos na Nórica', importance: 4, visibility: 0 }).catch(() => {});
      await pn.addListener('registration', async (t) => {
        try {
          const { noricaApi } = await import('@/lib/norica-api');
          await noricaApi.pushRegister(t.value);
          try { localStorage.setItem(TOKEN_KEY, t.value); } catch (_e) {}
        } catch (e) { reportError(e, 'push:registrar'); }
      });
      await pn.addListener('registrationError', (e) => reportError(e?.error ?? e, 'push:erro'));
      await pn.addListener('pushNotificationActionPerformed', (a) => {
        const route = a?.notification?.data?.route;
        if (typeof route === 'string' && route.startsWith('/')) navigate(route);
      });
      // Com o app aberto: avisa as telas (chat e amigos atualizam na hora).
      await pn.addListener('pushNotificationReceived', (n) => {
        window.dispatchEvent(new CustomEvent('norica-push', { detail: n?.data ?? {} }));
      });
    }
    await pn.register();
    return true;
  } catch (e) {
    reportError(e, 'push:iniciar');
    return false;
  }
}

/** Ao sair da conta: o aparelho para de receber avisos dessa pessoa. */
export async function stopPush() {
  let token: string | null = null;
  try { token = localStorage.getItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (_e) {}
  if (!token) return;
  try {
    const { noricaApi } = await import('@/lib/norica-api');
    await noricaApi.pushUnregister(token);
  } catch (_e) {}
}
