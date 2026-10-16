"use client";

// Caixa de calma: o que acalma a pessoa (frases, fotos, músicas, áudios de quem ela ama).
// Fica SÓ no aparelho (IndexedDB), nunca vai para o servidor. Abre primeiro no S.O.S.

import { useSyncExternalStore } from 'react';
import { getAuthState } from '@/lib/auth-store';

export type CalmItem = {
  id: string;
  kind: 'frase' | 'foto' | 'musica' | 'audio';
  text?: string;      // frase, legenda, nome da música ou de quem gravou
  url?: string;       // link da música
  blob?: Blob;        // foto (jpeg) ou áudio
  created: number;
};

const DB = 'norica-calma';
const STORE = 'itens';
let cache: CalmItem[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const owner = () => getAuthState().user?.id ?? 'anon';

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCalm(): Promise<CalmItem[]> {
  try {
    const all = await tx<any[]>('readonly', (s) => s.getAll());
    cache = all.filter((r) => r.owner === owner()).map((r) => r.item as CalmItem).sort((a, b) => a.created - b.created);
  } catch (_e) {
    cache = [];
  }
  emit();
  return cache;
}

export async function addCalm(item: Omit<CalmItem, 'id' | 'created'>) {
  const full: CalmItem = { ...item, id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, created: Date.now() };
  await tx('readwrite', (s) => s.put({ key: `${owner()}:${full.id}`, owner: owner(), item: full }));
  await loadCalm();
}

export async function removeCalm(id: string) {
  await tx('readwrite', (s) => s.delete(`${owner()}:${id}`));
  await loadCalm();
}

export function useCalm(): CalmItem[] | null {
  return useSyncExternalStore((l) => { listeners.add(l); if (cache === null) loadCalm(); return () => listeners.delete(l); }, () => cache, () => null);
}

/** Foto em tamanho bom para o celular (até 1080px, JPEG). */
export async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('foto'))), 'image/jpeg', 0.82));
}
