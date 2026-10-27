"use client";

// Estado de login compartilhado por todo o app.
// Antes cada tela chamava getSession() e mostrava seu próprio "carregando"; quando o token
// tinha vencido, todas esperavam a rede para renovar. Agora:
//   1. a sessão salva no aparelho é lida na hora → a Início abre imediatamente;
//   2. o Supabase confirma/renova o login em segundo plano e atualiza este estado.

import { useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient, peekStoredSession } from './supabase-client';
import { cacheClear, clearPersonalLocal } from './cache';

export type AuthState = { session: Session | null; user: User | null; ready: boolean };

const SERVER_STATE: AuthState = { session: null, user: null, ready: false };
let state: AuthState = SERVER_STATE;
let started = false;
const listeners = new Set<() => void>();

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function startAuth() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const supabase = createClient();

  peekStoredSession()
    .then((stored) => {
      if (!state.ready && stored?.user) setState({ session: stored, user: stored.user, ready: true });
    })
    .catch(() => {});

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { cacheClear(); clearPersonalLocal(); }
    if (event === 'PASSWORD_RECOVERY') { try { window.dispatchEvent(new CustomEvent('norica-recovery')); } catch (_e) {} }
    setState({ session, user: session?.user ?? null, ready: true });
  });

  // Rede muito lenta: não deixa a tela de abertura presa.
  setTimeout(() => {
    if (!state.ready) setState({ ready: true });
  }, 6000);
}

function subscribe(listener: () => void) {
  startAuth();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthState() {
  return state;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
