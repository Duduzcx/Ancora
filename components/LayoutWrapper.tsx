"use client";

import React, { useState, useEffect, useRef, ViewTransition } from 'react';
import { supabase } from '@/lib/supabase-client';
import { usePathname, useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import NavigationDock from '@/components/NavigationDock';
import AberturaNorica from '@/components/AberturaNorica';
import ConsentGate from '@/components/ConsentGate';
import Onboarding from '@/components/Onboarding';
import { useAuth } from '@/lib/auth-store';
import { warmUpServer } from '@/lib/norica-api';
import { flushOutbox, startOfflineSync } from '@/lib/offline-sync';
import { reportError, reportSlow } from '@/lib/error-report';
import { sampleFps } from '@/lib/perf-monitor';
import { applyEasyReading } from '@/lib/leitura';
import { GlobalBackgroundContext, OceanBackground } from '@/components/AnimatedBackground';
import { CHECKIN_ACTIONS, countAppOpen, listenReminderTaps, refreshEngagementNotifications } from '@/lib/reminder';

const LIVELY_BG = ['/porto', '/farol']; // telas com o fundo mais vivo (as demais usam o suave)
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
  // Conta as trocas de tela (a faixa de luz só aparece depois da primeira tela).
  const navCount = useRef(0);
  const lastPath = useRef<string | null>(null);
  // Login compartilhado: abre na hora com a sessão salva no aparelho.
  const { session, ready: authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  if (lastPath.current !== pathname) { if (lastPath.current !== null) navCount.current++; lastPath.current = pathname; }
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
    applyEasyReading();
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
    listenReminderTaps((route) => router.push(route), (answer) => {
      import('@/lib/norica-api').then(({ logMood }) => logMood(CHECKIN_ACTIONS[answer])).catch(() => {});
    }).then((stop) => { stopReminderTaps = stop; }).catch(() => {});

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

  // Push (Firebase): liga sozinho quando a pessoa está logada e já permitiu notificações.
  const uidForPush = session?.user?.id;
  useEffect(() => {
    if (!uidForPush) return;
    const t = setTimeout(() => { import('@/lib/push').then((m) => m.initPush((route) => router.push(route))).catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [uidForPush, router]);

  // Mede a fluidez de cada tela no celular de verdade (registra só quando trava).
  useEffect(() => {
    if (session?.user?.id && pathname) sampleFps(pathname);
  }, [pathname, session?.user?.id]);

  // Logado: deixa as telas principais e o servidor da IA prontos em segundo plano,
  // para a troca de página e a primeira resposta do Porto serem rápidas.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => {
      ['/porto/', '/farol/', '/perfil/', '/log/', '/arena/', '/cofre/', '/respiracao/', '/planos/', '/noite/', '/exercicios/', '/trilhas/', '/cartas/', '/terapia/', '/amigos/', '/calma/', '/mural/', '/datas/', '/movimento/', '/toque/']
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
  // Logado e fora das telas públicas: o fundo do mar fica no layout.
  const globalBg = !!session && !isPublic;

  return (
    <div className="min-h-screen bg-transparent relative">
      {!loading && (
        <GlobalBackgroundContext.Provider value={globalBg}>
          <div className="min-h-[100dvh] w-full relative z-0 flex flex-col">
            {/* Fundo do mar único e fixo: não é recriado ao trocar de tela */}
            {globalBg && <OceanBackground subtle={!LIVELY_BG.some((p) => pathname?.startsWith(p))} />}
            {/* Troca de tela "maré": a tela antiga recua e a nova sobe da água (View Transitions, na placa de vídeo).
                Em celulares sem suporte, entra só com um esmaecer rápido. */}
            <ViewTransition key={pathname} enter="mare-entra" exit="mare-sai" default="none">
              <div className="flex-1 w-full page-fallback">
                {children}
              </div>
            </ViewTransition>
            {/* Faixa de luz que atravessa a tela a cada troca (não aparece ao abrir o app) */}
            {navCount.current > 0 && <div key={`onda-${pathname}`} className="mare-onda" aria-hidden="true" />}
            <NavigationDock />
          </div>
        </GlobalBackgroundContext.Provider>
      )}
      {/* Abertura animada (uma vez por abertura do app); some quando o app está pronto */}
      <AberturaNorica ready={!loading} />
      {/* Consentimento LGPD para dados emocionais (uma vez por conta) */}
      {!isPublic && <ConsentGate userId={session?.user?.id ?? null} />}
      {/* Começo guiado (uma vez por conta, depois do consentimento) */}
      {!isPublic && !loading && <Onboarding />}
    </div>
  );
}
