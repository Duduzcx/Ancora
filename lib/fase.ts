"use client";

// Modo fase difícil: por algumas semanas a Nórica fica mais gentil — menos lembretes
// de sequência e "volte", mais acolhimento nas respostas e na Início.
// Fica só no aparelho (é um pedido da pessoa, não um diagnóstico).

import { useSyncExternalStore } from 'react';
import { getAuthState } from '@/lib/auth-store';

export type PhaseKind = 'luto' | 'termino' | 'demissao' | 'doenca' | 'mudanca' | 'cansaco' | 'outro';
export const PHASES: { id: PhaseKind; label: string; emoji: string }[] = [
  { id: 'luto', label: 'Perdi alguém', emoji: '🕊️' },
  { id: 'termino', label: 'Fim de relacionamento', emoji: '💔' },
  { id: 'demissao', label: 'Trabalho ou dinheiro', emoji: '💼' },
  { id: 'doenca', label: 'Doença (minha ou de alguém)', emoji: '🩺' },
  { id: 'mudanca', label: 'Uma grande mudança', emoji: '📦' },
  { id: 'cansaco', label: 'Esgotamento', emoji: '🪫' },
  { id: 'outro', label: 'Outra coisa', emoji: '🌧️' },
];
export const PHASE_WEEKS = [2, 4, 8];

export type Phase = { kind: PhaseKind; until: number; since: number };

const key = () => `norica-fase:${getAuthState().user?.id ?? 'anon'}`;
const listeners = new Set<() => void>();
let cached: { k: string; v: Phase | null } | null = null;

export function getPhase(): Phase | null {
  if (typeof window === 'undefined') return null;
  const k = key();
  if (cached?.k === k) return cached.v && cached.v.until > Date.now() ? cached.v : null;
  let v: Phase | null = null;
  try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch (_e) {}
  cached = { k, v };
  return v && v.until > Date.now() ? v : null;
}

function emit() { cached = null; listeners.forEach((l) => l()); window.dispatchEvent(new Event('norica-fase')); }

export function startPhase(kind: PhaseKind, weeks: number) {
  const p: Phase = { kind, since: Date.now(), until: Date.now() + weeks * 7 * 86400_000 };
  try { localStorage.setItem(key(), JSON.stringify(p)); } catch (_e) {}
  emit();
}

export function endPhase() {
  try { localStorage.removeItem(key()); } catch (_e) {}
  emit();
}

export const phaseLabel = (k: PhaseKind) => PHASES.find((p) => p.id === k)?.label ?? 'Fase difícil';

export function usePhase(): Phase | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    getPhase,
    () => null,
  );
}
