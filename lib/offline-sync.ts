"use client";

// Logs e humor funcionando sem internet.
// Tudo o que a pessoa marca é gravado primeiro no aparelho (fila "a enviar") e enviado
// ao Supabase assim que houver conexão: ao abrir o app, ao voltar para ele e quando a
// internet volta. Assim nada se perde no metrô, no avião ou com sinal fraco.

import { useSyncExternalStore } from 'react';
import { createClient } from './supabase-client';
import { getAuthState } from './auth-store';

export type HabitLogPayload = {
  day: string;
  completed: number[];
  custom_tasks: { id: string; text: string; completed: boolean }[];
  progress: number;
};
type MoodItem = { id: string; mood: string; created_at: string };
type Outbox = { habits: Record<string, HabitLogPayload>; moods: MoodItem[] };

const EMPTY: Outbox = { habits: {}, moods: [] };
const listeners = new Set<() => void>();
let pendingCount = 0;

async function currentUserId(): Promise<string | null> {
  const fromStore = getAuthState().user?.id;
  if (fromStore) return fromStore;
  const { data: { session } } = await createClient().auth.getSession();
  return session?.user?.id ?? null;
}

const outboxKey = (uid: string) => `norica-outbox:${uid}`;
const copyKey = (uid: string, day: string) => `norica-cache:${uid}:habit:${day}`;

function read(uid: string): Outbox {
  try {
    const raw = localStorage.getItem(outboxKey(uid));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { habits: {}, moods: [] };
  } catch (_e) {
    return { habits: {}, moods: [] };
  }
}

function write(uid: string, box: Outbox) {
  try {
    localStorage.setItem(outboxKey(uid), JSON.stringify(box));
  } catch (_e) {}
  const count = Object.keys(box.habits).length + box.moods.length;
  if (count !== pendingCount) {
    pendingCount = count;
    listeners.forEach((l) => l());
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch (_e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

// ---------------------------------------------------------------------

/** Grava o registro do dia no aparelho e tenta enviar. */
export async function queueHabitLog(log: HabitLogPayload) {
  const uid = await currentUserId();
  if (!uid) return;
  try {
    localStorage.setItem(copyKey(uid, log.day), JSON.stringify(log));
  } catch (_e) {}
  const box = read(uid);
  box.habits[log.day] = log;
  write(uid, box);
  await flushOutbox();
}

/** Registro do dia: a versão ainda não enviada vence; sem internet, usa a cópia do aparelho. */
export async function readHabitLog(day: string): Promise<HabitLogPayload | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const queued = read(uid).habits[day];
  if (queued) {
    flushOutbox().catch(() => {});
    return queued;
  }
  try {
    // Sem internet: nem tenta (o Supabase repete a tentativa por vários segundos).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    const query = createClient()
      .from('habit_logs')
      .select('day, completed, custom_tasks, progress')
      .eq('user_id', uid)
      .eq('day', day)
      .maybeSingle();
    // Sinal fraco: espera no máximo 5s e segue com a cópia do aparelho.
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
    const { data, error } = await Promise.race([query, timeout]);
    if (error) throw error;
    if (data) {
      try { localStorage.setItem(copyKey(uid, day), JSON.stringify(data)); } catch (_e) {}
    }
    return (data as HabitLogPayload) ?? null;
  } catch (_e) {
    try {
      const raw = localStorage.getItem(copyKey(uid, day));
      return raw ? (JSON.parse(raw) as HabitLogPayload) : null;
    } catch (_e2) {
      return null;
    }
  }
}

/** Humor marcado na Início: entra na fila com id próprio (reenviar nunca duplica). */
export async function queueMood(mood: string) {
  const uid = await currentUserId();
  if (!uid) return;
  const box = read(uid);
  box.moods.push({ id: newId(), mood, created_at: new Date().toISOString() });
  write(uid, box);
  await flushOutbox();
}

let flushing: Promise<void> | null = null;

/** Envia tudo o que está na fila. Seguro chamar várias vezes. */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const uid = await currentUserId();
      if (!uid) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        write(uid, read(uid)); // só atualiza o contador
        return;
      }
      const supabase = createClient();
      const box = read(uid);

      for (const [day, log] of Object.entries(box.habits)) {
        const { error } = await supabase.from('habit_logs').upsert({
          user_id: uid,
          day,
          completed: log.completed,
          custom_tasks: log.custom_tasks,
          progress: log.progress,
          updated_at: new Date().toISOString(),
        });
        if (error) break;
        // Só tira da fila se não mudou enquanto enviava.
        const latest = read(uid);
        if (JSON.stringify(latest.habits[day]) === JSON.stringify(log)) delete latest.habits[day];
        write(uid, latest);
      }

      const moods = read(uid).moods;
      if (moods.length) {
        const { error } = await supabase
          .from('mood_logs')
          .upsert(moods.map((m) => ({ ...m, user_id: uid })), { onConflict: 'id', ignoreDuplicates: true });
        if (!error) {
          const latest = read(uid);
          const sent = new Set(moods.map((m) => m.id));
          latest.moods = latest.moods.filter((m) => !sent.has(m.id));
          write(uid, latest);
        }
      }
    } catch (_e) {
      // sem conexão: fica na fila para a próxima tentativa
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

let started = false;
/** Liga o envio automático (ao voltar a internet e a cada 2 minutos enquanto houver pendências). */
export function startOfflineSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { flushOutbox(); });
  setInterval(() => { if (pendingCount > 0) flushOutbox(); }, 120_000);
  flushOutbox();
}

/** Quantos registros ainda esperam internet (para mostrar "salvo no aparelho"). */
export function usePendingSync(): number {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => pendingCount,
    () => 0,
  );
}
