"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { usePathname, useRouter } from 'next/navigation';
import { Anchor } from 'lucide-react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import NavigationDock from '@/components/NavigationDock';
import ConsentGate from '@/components/ConsentGate';
import Onboarding from '@/components/Onboarding';
import { useAuth } from '@/lib/auth-store';
import { warmUpServer } from '@/lib/norica-api';
import { flushOutbox, startOfflineSync } from '@/lib/offline-sync';
import { reportError, reportSlow } from '@/lib/error-report';
import { countAppOpen, listenReminderTaps, refreshEngagementNotifications } from '@/lib/reminder';

const publicPages = ['/auth', '/auth/signup', '/auth/forgot-password', '/privacidade', '/excluir-conta'];

const log = (msg: string) => console.log(`[AUTH_DEBUG] ${new Date().toLocaleTimeString()}: ${msg}`);

const isChunkError = (err: any, msg = '') =>
  msg.includes('Loading chunk') ||
  msg.includes('ChunkLoadError') ||
  err?.name === 'ChunkLoadError' ||
  err?.message?.includes('Loading chunk') ||
  err?.message?.includes('Failed to fetch dynamically imported module');

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  // Login compartilhado: abre na hora com a sessão salva no aparelho.
  const { session, ready: authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const openedRef = useRef(false);
  pathnameRef.current = pathname;

  // Widget "Como está o seu mar?" (com.zcx.norica://humor/<humor>): a Início registra e confirma.
  const openFromWidget = (url: string): boolean => {
    const h = url.match(/:\/\/habito\/(\d+)/);
    if (h) {
      try { window.dispatchEvent(new CustomEvent('norica-widget-habit', { detail: h[1] })); } catch (_e) {}
      router.push(`/?habito=${h[1]}`);
      return true;
    }
    const m = url.match(/:\/\/humor\/([a-z]+)/);
    if (!m) return false;
    if (m[1] !== 'abrir') {
      try { window.dispatchEvent(new CustomEvent('norica-widget', { detail: m[1] })); } catch (_e) {}
    }
    router.push(m[1] === 'abrir' ? '/' : `/?widget=${m[1]}`);
    return true;
  };

  // Ouvintes registrados UMA vez (antes eram recriados a cada troca de tela,
  // o que podia tentar usar o mesmo código de login duas vezes e falhar).
  useEffect(() => {
    setIsMounted(true);
    countAppOpen();
    log(`Montado! Pathname inicial: "${pathname}"`);

    const listeners: Promise<{ remove: () => void }>[] = [];

    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
      // Retorno do login pelo navegador (e-mail de confirmação, recuperação de senha, OAuth web).
      listeners.push(App.addListener('appUrlOpen', async (event: any) => {
        log(`DeepLink aberto: ${event.url}`);
        if (!(event.url.includes('com.zcx.norica') || event.url.includes('com.zcx.ancora'))) return;
        if (openFromWidget(event.url)) return;
        if (!(event.url.includes('access_token') || event.url.includes('code='))) return;
        try {
          const url = new URL(event.url.replace('#', '?'));
          const code = url.searchParams.get('code');
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          } else {
            const access_token = url.searchParams.get('access_token');
            const refresh_token = url.searchParams.get('refresh_token');
            if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
          }
        } catch (e: any) {
          log(`Erro no retorno do login: ${e?.message || e}`);
        }
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch (_e) {}
        router.push('/');
      }));

      // App aberto do zero por um toque no widget.
      App.getLaunchUrl().then((launch) => { if (launch?.url) openFromWidget(launch.url); }).catch(() => {});

      // Mantém o login vivo: renova o token quando o app volta para a tela.
      listeners.push(App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          supabase.auth.startAutoRefresh();
          flushOutbox().catch(() => {});
        } else {
          supabase.auth.stopAutoRefresh();
        }
      }));
    }

    const handleGlobalError = (event: ErrorEvent) => {
      log(`GLOBAL ERROR: "${event.message || ''}"`);
      if (isChunkError(event.error, event.message || '')) { window.location.reload(); return; }
      reportError(event.error ?? event.message, 'global');
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      log(`UNHANDLED REJECTION: "${event.reason?.message || String(event.reason)}"`);
      if (isChunkError(event.reason)) { window.location.reload(); return; }
      reportError(event.reason, 'promise');
    };
    // Toque no lembrete diário abre a Início.
    let stopReminderTaps: (() => void) | null = null;
    listenReminderTaps((route) => router.push(route)).then((stop) => { stopReminderTaps = stop; }).catch(() => {});

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      listeners.forEach(p => p.then(l => l.remove()).catch(() => {}));
      stopReminderTaps?.();
    };
  }, []);

  // Proteção das telas: a cada navegação, quem não está logado volta para a Início.
  useEffect(() => {
    if (!authReady) return;
    const isPublic = publicPages.some(page => pathname?.startsWith(page));
    log(`checkRedirect: session=${session ? 'YES' : 'NO'}, path="${pathname}", isPublic=${isPublic}`);
    if (!session && !isPublic && pathname !== '/') router.replace('/');
    // Abertura demorada (do toque no ícone até a primeira tela): registra para a equipe ver.
    if (!openedRef.current) {
      openedRef.current = true;
      const ms = typeof performance !== 'undefined' ? performance.now() : 0;
      if (ms > 4000) reportSlow('abertura do app', ms);
    }
    setLoading(false);
  }, [authReady, session, pathname, router]);

  // Logado: deixa as telas principais e o servidor da IA prontos em segundo plano,
  // para a troca de página e a primeira resposta do Porto serem rápidas.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => {
      ['/porto/', '/farol/', '/perfil/', '/log/', '/arena/', '/cofre/', '/respiracao/', '/planos/', '/noite/', '/exercicios/', '/trilhas/', '/cartas/', '/terapia/']
        .forEach((href) => { try { router.prefetch(href); } catch (_e) {} });
      warmUpServer(userId);
      startOfflineSync(); // envia Logs/humor marcados sem internet
      refreshEngagementNotifications().catch(() => {}); // resumo de domingo e "sentimos sua falta"
      import('@/lib/terapia').then(({ getTherapy, scheduleTherapy }) => scheduleTherapy(getTherapy())).catch(() => {}); // próxima consulta (se repete)
    }, 400);
    return () => clearTimeout(t);
  }, [userId, router]);

  if (!isMounted) return null;

  const isPublic = publicPages.some(page => pathname?.startsWith(page));

  return (
    <div className="min-h-screen bg-transparent relative">
      {!loading && (
        <div className="min-h-[100dvh] w-full relative z-0 flex flex-col">
          {/* Troca de tela: entrada suave feita pelo navegador (CSS na placa de vídeo) */}
          <div key={pathname} className="flex-1 w-full page-enter">
            {children}
          </div>
          <NavigationDock />
        </div>
      )}
      {/* Tela de abertura: some por cima do conteúdo já desenhado (antes a tela esperava a animação terminar). */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#021013]"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center relative overflow-hidden border border-white/10">
                <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                <Anchor className="text-emerald-400 animate-bounce relative z-10" size={56} strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em] animate-pulse">Ancorando...</p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Consentimento LGPD para dados emocionais (uma vez por conta) */}
      {!isPublic && <ConsentGate userId={session?.user?.id ?? null} />}
      {/* Começo guiado (uma vez por conta, depois do consentimento) */}
      {!isPublic && !loading && <Onboarding />}
    </div>
  );
}
