"use client";

// Registro de erros e lentidão (tabela app_errors no Supabase).
// Mostra à equipe o que falha ou demora nos celulares das pessoas, sem precisar
// que elas avisem. Nunca envia conteúdo de conversa, Cofre ou Logs: só a mensagem
// técnica, a tela e o modelo do aparelho.

import pkg from '@/package.json';
import { createClient } from './supabase-client';
import { getAuthState } from './auth-store';

const MAX_PER_SESSION = 15;
const sent = new Set<string>();
let count = 0;

const IGNORE = [
  /ResizeObserver loop/i,
  /AbortError/i,
  /Load failed/i,
  /Network ?Error/i,
  /Failed to fetch/i, // sem internet: não é bug do app
  /cancel/i,
];

function device(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const android = ua.match(/Android [^;)]+/)?.[0] ?? '';
  const model = ua.match(/; ([^;)]+) Build\//)?.[1] ?? '';
  const chrome = ua.match(/Chrome\/(\d+)/)?.[1];
  return [android, model, chrome ? `WebView ${chrome}` : ''].filter(Boolean).join(' · ').slice(0, 300) || ua.slice(0, 300);
}

function send(row: { kind: 'error' | 'slow'; message: string; stack?: string | null; duration_ms?: number | null }) {
  if (typeof window === 'undefined' || count >= MAX_PER_SESSION) return;
  const page = window.location.pathname.slice(0, 200);
  const key = `${row.kind}|${row.message}|${page}`;
  if (sent.has(key)) return;
  sent.add(key);
  count++;
  const userId = getAuthState().user?.id ?? null;
  createClient()
    .from('app_errors')
    .insert({
      user_id: userId,
      kind: row.kind,
      message: row.message.slice(0, 500),
      stack: row.stack ? row.stack.slice(0, 4000) : null,
      page,
      app_version: String(pkg.version ?? '').slice(0, 40),
      device: device(),
      duration_ms: row.duration_ms ?? null,
    })
    .then(() => {}, () => {});
}

/** Erro inesperado (tela quebrou, promessa sem tratamento, falha do servidor). */
export function reportError(error: unknown, context?: string) {
  const err = error as { message?: string; stack?: string; name?: string } | undefined;
  const base = err?.message || (typeof error === 'string' ? error : 'Erro desconhecido');
  if (err?.name === 'AbortError' || IGNORE.some((re) => re.test(base))) return;
  send({ kind: 'error', message: context ? `[${context}] ${base}` : base, stack: err?.stack ?? null });
}

/** Algo demorou mais do que deveria (abertura do app, primeira palavra do Porto…). */
export function reportSlow(what: string, ms: number) {
  send({ kind: 'slow', message: what, duration_ms: Math.round(ms) });
}
