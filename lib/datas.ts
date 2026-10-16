"use client";

// Datas que pesam: a pessoa marca dias difíceis (aniversário de uma perda, um término,
// a data de uma prova). Nesses dias a Nórica fica mais atenta: card gentil na Início,
// um bom-dia cuidadoso e a IA sabe que é um dia sensível. Fica só no aparelho.

import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { cancelNotices, scheduleNotices } from '@/lib/reminder';

export type SensitiveDate = { id: string; md: string; label: string; yearly: boolean; year?: number }; // md = "MM-DD"
const KEY = 'datas';
const NOTICE_BASE = 7700;
const uid = () => getAuthState().user?.id;

export function getDates(): SensitiveDate[] {
  return cacheGet<SensitiveDate[]>(uid(), KEY) ?? [];
}

export function saveDates(list: SensitiveDate[]) {
  cacheSet(uid(), KEY, list.slice(0, 20));
  scheduleDates().catch(() => {});
}

const mdOf = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function todaysDate(now = new Date()): SensitiveDate | null {
  const md = mdOf(now);
  return getDates().find((d) => d.md === md && (d.yearly || d.year === now.getFullYear())) ?? null;
}

/** Texto curto para a IA saber que hoje pesa (só o rótulo que a pessoa escreveu). */
export function todaySensitiveNote(): string | null {
  try { return todaysDate()?.label ?? null; } catch (_e) { return null; }
}

function nextOccurrence(d: SensitiveDate): Date | null {
  const [m, day] = d.md.split('-').map(Number);
  const now = new Date();
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    if (!d.yearly && d.year !== y) continue;
    const at = new Date(y, m - 1, day, 8, 30, 0, 0);
    if (at.getTime() > Date.now()) return at;
  }
  return null;
}

/** Aviso discreto às 8h30 do dia (o texto não revela o motivo na tela bloqueada). */
export async function scheduleDates() {
  await cancelNotices(Array.from({ length: 20 }, (_, i) => NOTICE_BASE + i));
  const list = getDates();
  const notices = list.map((d, i) => ({ d, i, at: nextOccurrence(d) })).filter((x) => x.at)
    .map(({ i, at }) => ({ id: NOTICE_BASE + i, at: at!, title: 'Hoje, vá com calma 💙', body: 'A Nórica está por perto se o dia pesar.', route: '/' }));
  if (notices.length) await scheduleNotices(notices);
}

export const newDateId = () => `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
