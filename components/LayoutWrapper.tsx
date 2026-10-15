"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { usePathname, useRouter } from 'next/navigation';
import { Anchor } from 'lucide-react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import NavigationDock from '@/components/NavigationDock';

const publicPages = ['/auth', '/auth/signup', '/auth/forgot-password', '/privacidade'];

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-8), `${time}: ${msg}`]);
    console.log(`[AUTH_DEBUG] ${msg}`);
  };

  useEffect(() => {
    setIsMounted(true);
    addLog(`Montado! Pathname inicial: "${pathname}"`);
    
    let deepLinkHandlerPromise: Promise<any> | null = null;
    const setupDeepLinks = async () => {
      try {
        const isNative = Capacitor.isNativePlatform();
        if (isNative && Capacitor.isPluginAvailable('App')) {
          deepLinkHandlerPromise = App.addListener('appUrlOpen', async (event: any) => {
            addLog(`DeepLink aberto: ${event.url}`);
            if (event.url.includes('com.zcx.norica') || event.url.includes('com.zcx.ancora')) {
              if (event.url.includes('access_token') || event.url.includes('code=')) {
                const url = new URL(event.url.replace('#', '?'));
                const code = url.searchParams.get('code');
                
                if (code) {
                  addLog("DeepLink contem código, trocando por sessão...");
                  await supabase.auth.exchangeCodeForSession(code);
                } else {
                  addLog("DeepLink sem código, chamando getSession...");
                  await supabase.auth.getSession();
                }
                addLog("Navegando para / pós deeplink");
                router.push('/');
              }
            }
          });
        } else {
          addLog("Capacitor App plugin não disponível ou plataforma não nativa.");
        }
      } catch (e: any) {
        addLog(`Erro ao configurar DeepLinks: ${e?.message || e}`);
      }
    };

    setupDeepLinks();

    let hasCheckedAuth = false;

    const checkRedirect = (currentSession: any) => {
      const isPublic = publicPages.some(page => pathname?.startsWith(page));
      addLog(`checkRedirect: session=${currentSession ? "YES" : "NO"}, path="${pathname}", isPublic=${isPublic}`);
      
      if (!currentSession && !isPublic && pathname !== '/') {
        addLog(`-> REDIRECTING to "/" !`);
        router.push('/');
      } else {
        addLog(`-> No redirect needed.`);
      }
      setLoading(false);
    };

    // Inscreve no onAuthStateChange e monitora o carregamento inicial
    addLog("Inscrevendo no onAuthStateChange...");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`onAuthStateChange: event="${event}", session=${session ? "YES" : "NO"}`);
      setSession(session);
      
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        hasCheckedAuth = true;
        checkRedirect(session);
      }
    });

    // Fallback de segurança para garantir que a tela não trave caso o INITIAL_SESSION falhe ou demore
    const fallbackTimeout = setTimeout(async () => {
      if (!hasCheckedAuth) {
        addLog("Fallback timeout acionado!");
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          addLog(`Fallback getSession: ${currentSession ? "YES" : "NO"}`);
          setSession(currentSession);
          checkRedirect(currentSession);
        } catch (e: any) {
          addLog(`Erro no fallback getSession: ${e?.message || e}`);
          setLoading(false);
        }
      }
    }, 1200);

    const handleGlobalError = (event: ErrorEvent) => {
      const errorMsg = event.message || '';
      const isChunkError = 
        errorMsg.includes('Loading chunk') || 
        errorMsg.includes('ChunkLoadError') || 
        (event.error && (event.error.name === 'ChunkLoadError' || event.error.message?.includes('Loading chunk') || event.error.message?.includes('Failed to fetch dynamically imported module')));
      
      addLog(`GLOBAL ERROR: "${errorMsg}"`);
      if (isChunkError) {
        addLog('ChunkLoadError detectado! Recarregando página...');
        window.location.reload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorMsg = error?.message || String(error);
      addLog(`UNHANDLED REJECTION: "${errorMsg}"`);
      if (error && (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk') || error.message?.includes('Failed to fetch dynamically imported module'))) {
        addLog('ChunkLoadError detectado via promise rejection! Recarregando página...');
        window.location.reload();
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      addLog("Limpando useEffect...");
      subscription.unsubscribe();
      clearTimeout(fallbackTimeout);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      if (deepLinkHandlerPromise) {
        deepLinkHandlerPromise.then(handler => handler.remove()).catch(() => {});
      }
    };
  }, [pathname, router]);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-transparent relative">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#021013]"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center relative overflow-hidden border border-white/10">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse" />
                <Anchor className="text-emerald-400 animate-bounce relative z-10" size={56} strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em] animate-pulse">Ancorando...</p>
          </motion.div>
        ) : (
          <div className="min-h-[100dvh] w-full relative z-0 flex flex-col">
              <motion.div 
                key={pathname}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex-1 w-full"
              >
                {children}
              </motion.div>
            <NavigationDock />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}