"use client";

// Cartas para o futuro: guarda no aparelho só a data de chegada (sem o texto),
// para a Início avisar "uma carta sua chegou" sem precisar de internet.

import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import type { FutureLetter } from '@/lib/norica-api';
import { scheduleNotices } from '@/lib/reminder';

export type LetterMeta = { id: string; deliver_at: string; opened: boolean };
const KEY = 'cartas';

export const noticeId = (id: string) => 7600 + (parseInt(id.replace(/-/g, '').slice(0, 6), 16) % 300 || 0);

export function lettersMeta(): LetterMeta[] {
  return cacheGet<LetterMeta[]>(getAuthState().user?.id, KEY) ?? [];
}

export function rememberLetters(list: FutureLetter[]) {
  cacheSet(getAuthState().user?.id, KEY, list.map((l) => ({ id: l.id, deliver_at: l.deliver_at, opened: l.opened })));
  try { window.dispatchEvent(new CustomEvent('norica-cartas')); } catch (_e) {}
}

/** Carta que já chegou e ainda não foi aberta (para o card da Início). */
export function arrivedLetter(): LetterMeta | null {
  return lettersMeta().find((l) => !l.opened && new Date(l.deliver_at).getTime() <= Date.now()) ?? null;
}

export async function scheduleLetter(l: FutureLetter) {
  await scheduleNotices([{ id: noticeId(l.id), at: new Date(l.deliver_at), title: 'Uma carta sua chegou 💌', body: 'Você escreveu para você mesmo(a). Hoje é o dia de ler.', route: `/cartas/?id=${l.id}` }]);
}
