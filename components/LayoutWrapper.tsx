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
import { useAuth } from '@/lib/auth-store';
import { warmUpServer } from '@/lib/norica-api';

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
  pathnameRef.current = pathname;

  // Ouvintes registrados UMA vez (antes eram recriados a cada troca de tela,
  // o que podia tentar usar o mesmo código de login duas vezes e falhar).
  useEffect(() => {
    setIsMounted(true);
    log(`Montado! Pathname inicial: "${pathname}"`);

    const listeners: Promise<{ remove: () => void }>[] = [];

    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
      // Retorno do login pelo navegador (e-mail de confirmação, recuperação de senha, OAuth web).
      listeners.push(App.addListener('appUrlOpen', async (event: any) => {
        log(`DeepLink aberto: ${event.url}`);
        if (!(event.url.includes('com.zcx.norica') || event.url.includes('com.zcx.ancora'))) return;
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

      // Mantém o login vivo: renova o token quando o app volta para a tela.
      listeners.push(App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }));
    }

    const handleGlobalError = (event: ErrorEvent) => {
      log(`GLOBAL ERROR: "${event.message || ''}"`);
      if (isChunkError(event.error, event.message || '')) window.location.reload();
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      log(`UNHANDLED REJECTION: "${event.reason?.message || String(event.reason)}"`);
      if (isChunkError(event.reason)) window.location.reload();
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      listeners.forEach(p => p.then(l => l.remove()).catch(() => {}));
    };
  }, []);

  // Proteção das telas: a cada navegação, quem não está logado volta para a Início.
  useEffect(() => {
    if (!authReady) return;
    const isPublic = publicPages.some(page => pathname?.startsWith(page));
    log(`checkRedirect: session=${session ? 'YES' : 'NO'}, path="${pathname}", isPublic=${isPublic}`);
    if (!session && !isPublic && pathname !== '/') router.replace('/');
    setLoading(false);
  }, [authReady, session, pathname, router]);

  // Logado: deixa as telas principais e o servidor da IA prontos em segundo plano,
  // para a troca de página e a primeira resposta do Porto serem rápidas.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => {
      ['/porto/', '/farol/', '/perfil/', '/log/', '/arena/', '/cofre/', '/respiracao/', '/planos/']
        .forEach((href) => { try { router.prefetch(href); } catch (_e) {} });
      warmUpServer(userId);
    }, 400);
    return () => clearTimeout(t);
  }, [userId, router]);

  if (!isMounted) return null;

  const isPublic = publicPages.some(page => pathname?.startsWith(page));

  return (
    <div className="min-h-screen bg-transparent relative">
      {!loading && (
        <div className="min-h-[100dvh] w-full relative z-0 flex flex-col">
          <motion.div
            key={pathname}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="flex-1 w-full"
          >
            {children}
          </motion.div>
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
    </div>
  );
}
