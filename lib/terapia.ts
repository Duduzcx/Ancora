"use client";

// Agenda da terapia: próxima consulta, repetição e lista "o que quero levar".
// Fica só no aparelho (por conta) e agenda avisos na véspera e 2h antes.

import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { cancelNotices, scheduleNotices } from '@/lib/reminder';

export type Repeat = 'nenhuma' | 'semanal' | 'quinzenal';
export type TherapyNote = { id: string; text: string; done: boolean };
export type TherapyState = { next: string | null; repeat: Repeat; dayBefore: boolean; twoHours: boolean; notes: TherapyNote[] };

const KEY = 'terapia';
const EMPTY: TherapyState = { next: null, repeat: 'semanal', dayBefore: true, twoHours: true, notes: [] };
export const DAY_BEFORE_ID = 7900;
export const TWO_HOURS_ID = 7901;

const uid = () => getAuthState().user?.id;

/** Se a consulta já passou e ela se repete, já mostra a próxima. */
function roll(s: TherapyState): TherapyState {
  if (!s.next || s.repeat === 'nenhuma') return s;
  const step = s.repeat === 'semanal' ? 7 : 14;
  const d = new Date(s.next);
  let moved = false;
  while (d.getTime() < Date.now() - 2 * 3600_000) { d.setDate(d.getDate() + step); moved = true; }
  return moved ? { ...s, next: d.toISOString() } : s;
}

export function getTherapy(): TherapyState {
  const s = roll({ ...EMPTY, ...(cacheGet<TherapyState>(uid(), KEY) ?? {}) });
  return s;
}

export function saveTherapy(s: TherapyState) {
  cacheSet(uid(), KEY, s);
  try { window.dispatchEvent(new CustomEvent('norica-terapia')); } catch (_e) {}
}

export async function scheduleTherapy(s: TherapyState) {
  await cancelNotices([DAY_BEFORE_ID, TWO_HOURS_ID]);
  if (!s.next) return;
  const at = new Date(s.next);
  const list = [];
  if (s.dayBefore) {
    const eve = new Date(at);
    eve.setDate(eve.getDate() - 1);
    eve.setHours(19, 0, 0, 0);
    list.push({ id: DAY_BEFORE_ID, at: eve, title: 'Amanhã tem terapia 🛋️', body: 'Que tal anotar o que você quer levar para a sessão?', route: '/terapia/' });
  }
  if (s.twoHours) {
    list.push({ id: TWO_HOURS_ID, at: new Date(at.getTime() - 2 * 3600_000), title: 'Sua consulta é daqui a 2 horas', body: 'Sua lista do que quer falar está pronta na Nórica.', route: '/terapia/' });
  }
  await scheduleNotices(list);
}

export const newNoteId = () => `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
