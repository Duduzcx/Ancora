"use client";

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Anchor, Mail, Lock, ArrowRight, Loader2, User, Wind, Cloud, Zap, LifeBuoy, MessageCircle, Sword, Lightbulb, CheckCircle2, Shield, Eye, EyeOff, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase-client';
import { logMood, markHabitToday, toMood, type Mood } from '@/lib/norica-api';
import RodaEmocoes from '@/components/RodaEmocoes';
import { TASK_LABELS } from '@/lib/farol';
import { firstName } from '@/lib/user-name';
import { useRouter } from 'next/navigation';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import AnimatedBackground from '@/components/AnimatedBackground';
import NoiteCard from '@/components/NoiteCard';
import HojeCards from '@/components/HojeCards';
import ShineText from '@/components/ShineText';
import RevealOnScroll from '@/components/RevealOnScroll';
import LoginBackground from '@/components/LoginBackground';
import NeblinaSOS from '@/components/NeblinaSOS';
import { useAuth } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { dismissReminderInvite, enableReminder, rememberForNotifications, shouldInviteReminder } from '@/lib/reminder';
import { Bell, X } from 'lucide-react';

// Luz que percorre a borda dos cards, um card de cada vez (Porto → Arena → Farol → Cofre → Logs).
// Antes a página inteira era redesenhada a cada passo e a luz era animada por JavaScript, o que
// travava. Agora um relógio leve só liga/desliga o card da vez; a luz em si é animação CSS.
// Passos: 0,2,4,6,8 = borda do card (3s); 1,3,5,7 = fio de luz até o próximo card (0,3s).
const snakeClock = (() => {
  let step = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subs = new Set<() => void>();
  const next = () => {
    step = (step + 1) % 9;
    subs.forEach((f) => f());
    timer = setTimeout(next, step % 2 === 0 ? 3000 : 300);
  };
  return {
    get: () => step,
    subscribe(f: () => void) {
      subs.add(f);
      if (!timer) timer = setTimeout(next, 3000);
      return () => {
        subs.delete(f);
        if (!subs.size && timer) { clearTimeout(timer); timer = null; step = 0; }
      };
    },
  };
})();
const useSnakeStep = () => useSyncExternalStore(snakeClock.subscribe, snakeClock.get, () => 0);

const SnakeBorder = ({ index, color }: { index: number; color: string }) => {
  const step = useSnakeStep();
  const on = step === index * 2;
  // Fica sempre montada (montar/desmontar a cada 3s criava e destruía camadas na placa de vídeo,
  // o que fazia os cards piscarem). Só a classe "is-on" liga a volta da luz.
  // A borda é recortada por máscara CSS: nada cobre o conteúdo do card.
  return (
    <div className={`snake-ring ${on ? 'is-on' : ''}`} aria-hidden="true">
      <div
        className="snake-spin"
        style={{ background: `conic-gradient(from 0deg, transparent 0deg, transparent 250deg, ${color} 320deg, #ffffff 340deg, transparent 352deg)` }}
      />
    </div>
  );
};

// Fio de luz que desce de um card para o próximo.
const SnakeGap = ({ index }: { index: number }) => {
  const step = useSnakeStep();
  const on = step === index * 2 + 1;
  return (
    <div className="absolute -bottom-6 left-6 w-[2px] h-6 z-20 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className={`w-full h-full bg-white snake-gap ${on ? 'is-on' : ''}`} />
    </div>
  );
};

const LighthouseIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || 2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M8 9h8" />
    <path d="M9 14h6" />
    <path d="M12 3l2 3h-4l2-3z" />
    <path d="M10 6L8 21h8l-2-15" />
    <path d="M3 21h18" />
  </svg>
);

// Animações
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const modulesContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12
    }
  }
};

const moduleCardVariants = {
  hidden: { y: 60, scale: 0.9, opacity: 0 },
  visible: {
    y: 0,
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 10,
      mass: 0.8
    }
  }
};

export default function Home() {
  const [mostrarNeblina, setMostrarNeblina] = useState(false);
  // Login compartilhado pelo app inteiro: a Início aparece na hora, sem um segundo "carregando".
  const { user: authUser, ready } = useAuth();
  const isCheckingAuth = !ready;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const user = authUser;
  const [profileName, setProfileName] = useState<string | null>(null);

  // Nome escolhido no Perfil (vale mais que o nome da conta Google).
  // Mostra o último nome salvo no aparelho na hora e confere com o servidor em segundo plano.
  useEffect(() => {
    if (!user?.id) return;
    const cached = cacheGet<string>(user.id, 'profileName');
    if (cached) setProfileName(cached);
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        const n = data?.display_name ?? null;
        setProfileName(n);
        cacheSet(user.id, 'profileName', n);
      });
  }, [user?.id]);

  // Primeiro nome guardado no aparelho para personalizar as notificações.
  useEffect(() => {
    if (!user) return;
    const n = firstName(user, profileName);
    if (n && n !== 'Navegador') rememberForNotifications({ name: n });
  }, [user?.id, profileName]);

  // Convite para o lembrete diário (uma vez, a partir da 2ª visita) e registro vindo do widget.
  const [showInvite, setShowInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [feelingFor, setFeelingFor] = useState<Exclude<Mood, 'sos'> | null>(null);
  const [habitToast, setHabitToast] = useState<{ label: string; fresh: boolean } | null>(null);
  const [widgetToast, setWidgetToast] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    setShowInvite(shouldInviteReminder());
    let last = { value: '', at: 0 };
    const fromWidget = (value: string | null) => {
      // O mesmo toque pode chegar pelo link e pelo evento: registra uma vez só.
      if (!value || (last.value === value && Date.now() - last.at < 3000)) return;
      last = { value, at: Date.now() };
      if (value === 'sos') { logMood('sos').catch(() => {}); setMostrarNeblina(true); return; }
      const mood = toMood(value);
      if (!mood) return;
      logMood(mood).catch(() => {});
      setWidgetToast(mood);
      setTimeout(() => setWidgetToast(null), 8000);
    };
    // Pérola marcada pelo widget (Bebi água, Respirei, Saí de casa)
    let lastHabit = { id: '', at: 0 };
    const fromHabit = async (id: string | null) => {
      if (!id || (lastHabit.id === id && Date.now() - lastHabit.at < 3000)) return;
      lastHabit = { id, at: Date.now() };
      const n = Number(id);
      if (!TASK_LABELS[n]) return;
      const fresh = await markHabitToday(n).catch(() => false);
      setHabitToast({ label: TASK_LABELS[n], fresh });
      setTimeout(() => setHabitToast(null), 6000);
    };
    const qs = new URLSearchParams(window.location.search);
    const param = qs.get('widget');
    const habitParam = qs.get('habito');
    const cleanUrl = () => { try { window.history.replaceState(window.history.state, '', '/'); } catch (_e) {} };
    if (param) { fromWidget(param); cleanUrl(); }
    if (habitParam) { fromHabit(habitParam); cleanUrl(); }
    // Respondeu o check-in da noite pela notificação (o humor já foi registrado)
    const checkin = qs.get('checkin');
    if (checkin === 'bem' || checkin === 'mais') { setWidgetToast(checkin === 'bem' ? 'calmo' : 'ansioso'); setTimeout(() => setWidgetToast(null), 8000); cleanUrl(); }
    const onWidget = (e: any) => { fromWidget(e.detail); setTimeout(cleanUrl, 300); };
    const onHabit = (e: any) => { fromHabit(e.detail); setTimeout(cleanUrl, 300); };
    window.addEventListener('norica-widget', onWidget);
    window.addEventListener('norica-widget-habit', onHabit);
    return () => { window.removeEventListener('norica-widget', onWidget); window.removeEventListener('norica-widget-habit', onHabit); };
  }, [user?.id]);

  const acceptInvite = async () => {
    const r = await enableReminder(20, 0);
    dismissReminderInvite();
    if (r === 'ok') { setInviteMsg('Combinado! Todo dia às 20h. Você muda o horário em Perfil → Notificações.'); setTimeout(() => setShowInvite(false), 4000); }
    else if (r === 'denied') { setInviteMsg('O celular bloqueou as notificações. Dá para liberar em Configurações → Apps → Nórica.'); setTimeout(() => setShowInvite(false), 6000); }
    else setShowInvite(false);
  };

  useEffect(() => {
    // Esconde o menu global quando a neblina está ativa
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toggleDock', { detail: !mostrarNeblina }));
    }
  }, [mostrarNeblina]);

  const handleNavigate = (e: React.MouseEvent | React.FormEvent, href: string) => {
    if (e) e.preventDefault();
    router.push(href);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId || clientId.startsWith("YOUR_GOOGLE_WEB_CLIENT_ID")) {
          throw new Error("Client ID do Google não configurado no arquivo de ambiente.");
        }
        await GoogleSignIn.initialize({
          clientId: clientId,
          serverClientId: clientId, // Faltava isso para o Supabase!
          scopes: ['email', 'profile'],
          offlineAccess: true, // Faltava isso para gerar o token corretamente
        });
        const result = await GoogleSignIn.signIn();
        if (!result.idToken) {
          throw new Error("Não foi possível obter o token do Google Sign-In.");
        }
        const { data, error: signInError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.zcx.norica://login-callback',
            queryParams: { prompt: 'select_account' },
            skipBrowserRedirect: true
          },
        });
        if (error) throw error;
        if (data?.url) await Browser.open({ url: data.url, windowName: '_self' });
      }
    } catch (err: any) {
      setError(err.message || "Falha na conexão Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password.trim() 
      });
      if (signInError) throw signInError;
    } catch (err: any) {
      setError("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };


  if (isCheckingAuth) {
    return (
      <main className="h-[100dvh] w-full bg-transparent flex items-center justify-center">
        <Loader2 className="text-emerald-400 animate-spin" size={40} />
      </main>
    );
  }

  // Só o primeiro nome (nunca o e-mail inteiro).
  const formattedName = firstName(user, profileName);

  if (user) {
    return (
      <main className="min-h-screen relative transition-all overflow-x-hidden pb-32 selection:bg-emerald-500/10 scroll-smooth">
        <AnimatedBackground subtle />
        
        {/* Sombra Se Movendo Lentamente - Efeito Fundo do Mar */}
        <div className="fixed inset-[-15%] pointer-events-none z-[-5] opacity-60 sea-shadow"
          style={{ backgroundImage: `radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(2,10,16,0.6) 100%)` }}
        />
        
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="hero-section"
        >
          {/* Top Section */}
          <div className="pt-16 pb-8 px-6 text-center space-y-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            Navegação Mental
          </div>
          
          <motion.h1 
            initial={false}
            animate={{ 
              opacity: 1, 
              scale: 1
            }}
            transition={{ 
              opacity: { duration: 0.6, ease: "easeOut" },
              scale: { duration: 0.6, ease: "easeOut" }
            }}
            className="font-black text-white tracking-tighter leading-tight mt-6 whitespace-nowrap"
          >
            <span className="text-[34px] md:text-[42px] block leading-none mb-3">
              Sua
              <ShineText base="#DB2777" band="#ffffff" duration={2.5} className="font-brain text-6xl md:text-7xl normal-case px-1 ml-1 mr-2">mente</ShineText>
              em
            </span>
            <span className="text-emerald-400 italic block text-[52px] md:text-[64px] tracking-[-0.05em]">Solo firme.</span>
          </motion.h1>
          
          <p className="text-white/70 text-lg max-w-xs mx-auto font-bold leading-relaxed px-4 italic">
            A vida é um mar que não obedece a ninguém. Nórica é o seu sistema de mapeamento de hábitos e reflexão diária.
          </p>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => handleNavigate(e, '/porto/')}
            className="mt-2 px-10 py-4 bg-emerald-500/80 text-white border border-emerald-400/20 rounded-full font-black text-[12px] uppercase tracking-widest inline-flex items-center gap-3 shadow-[0_8px_32px_0_rgba(16,185,129,0.3)] active:scale-95 transition-all breath-pulse hover:bg-emerald-500"
          >
            Entrar no Porto
            <ArrowRight size={16} />
          </motion.button>
        </div>

        {/* Mood Section Wrapped in Card */}
        <RevealOnScroll className="mx-6 mt-12 mb-10 relative z-20">
          <div className="bg-slate-900/60 border border-white/10 rounded-[3rem] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden relative group">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none shimmer-pass" />
            
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-24 -mt-24 blur-3xl transition-transform group-hover:scale-110 duration-700" />
            
            <div className="relative z-10 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-tight leading-none">
                    Olá, <span className="text-emerald-400 font-brain text-2xl normal-case ml-1">{formattedName}</span>.
                  </h2>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-1">Diário de Navegação</p>
                </div>
                <div className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center text-white/50 border border-white/10 shadow-inner">
                  <Anchor size={18} strokeWidth={1.5} />
                </div>
              </div>

              {/* Question */}
              <div className="text-center py-1">
                 <h3 className="text-2xl font-black text-white tracking-tighter italic leading-none">
                   Como está seu <ShineText base="#3b82f6" band="#7dd3fc" duration={3} sweep="loop" className="px-1">mar</ShineText> hoje?
                 </h3>
              </div>

              {/* Mood Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {h:'Calmo', i:Wind, d:'Serenidade', from: '#10b981', to: '#059669', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20'}, 
                  {h:'Ansioso', i:Cloud, d:'Neblina', from: '#f59e0b', to: '#d97706', bg: 'bg-amber-500/10', border: 'border-amber-500/20'}, 
                  {h:'Agitado', i:Zap, d:'Tormenta', from: '#f43f5e', to: '#e11d48', bg: 'bg-rose-500/10', border: 'border-rose-500/20'}, 
                  {h:'S.O.S', i:LifeBuoy, d:'Resgate', from: '#3b82f6', to: '#2563eb', bg: 'bg-blue-500/10', border: 'border-blue-500/20'}
                ].map((item, idx) => (
                  <RevealOnScroll key={item.h} delay={idx * 0.06}>
                    <motion.button 
                      style={{ willChange: 'transform' }}
                      whileHover={{ scale: 1.02, y: -2 }} 
                      whileTap={{ scale: 0.98 }} 
                      onClick={() => {
                        // S.O.S abre o resgate na hora; os outros abrem a roda das emoções.
                        const mood = toMood(item.h);
                        if (item.h === 'S.O.S') {
                          if (mood) logMood(mood).catch(() => {});
                          setMostrarNeblina(true);
                        } else if (mood && mood !== 'sos') {
                          setFeelingFor(mood);
                        }
                      }}
                      className={`w-full h-full bg-white/5 border ${item.border} rounded-[2rem] p-4 flex flex-col items-center gap-3 transition-all hover:bg-white/10 hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.05)] ${item.h === 'S.O.S' ? 'breath-pulse-rose' : ''}`}
                    >
                      <div className={`w-11 h-11 ${item.bg} rounded-2xl flex items-center justify-center mx-auto shadow-inner`}>
                        <item.i size={22} style={{ color: item.from }} strokeWidth={2.5} />
                      </div>
                      <div className="text-center min-w-0 w-full">
                        <span 
                          className="text-sm font-black tracking-tighter block leading-none uppercase italic truncate"
                          style={{ 
                            background: `linear-gradient(to bottom, ${item.from}, ${item.to})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }}
                        >
                          {item.h}
                        </span>
                        <span className="text-[8px] font-bold text-white/45 uppercase tracking-widest block mt-1 truncate">{item.d}</span>
                      </div>
                    </motion.button>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScroll>

        {/* Convite: lembrete diário */}
        {showInvite && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-6 -mt-4 mb-6 relative z-20">
            <div className="bg-slate-900/60 border border-sky-500/20 rounded-[2.5rem] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-300 border border-sky-500/20 shrink-0">
                  <Bell size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black text-white tracking-tight leading-tight">Quer que eu te lembre todo dia?</h3>
                  <p className="text-xs text-white/55 font-semibold leading-relaxed mt-1">Um convite gentil por dia para registrar seu mar. Um minuto já faz diferença.</p>
                </div>
                <button onClick={() => { dismissReminderInvite(); setShowInvite(false); }} className="p-1 text-white/30" aria-label="Fechar"><X size={16} /></button>
              </div>
              {inviteMsg ? (
                <p className="text-xs font-bold text-sky-300 leading-relaxed">{inviteMsg}</p>
              ) : (
                <div className="flex gap-2">
                  <button onClick={acceptInvite} className="flex-1 py-3 rounded-2xl bg-sky-500 text-slate-950 font-black uppercase tracking-widest text-[10px]">Sim, às 20h</button>
                  <button onClick={() => { dismissReminderInvite(); setShowInvite(false); }} className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px]">Agora não</button>
                </div>
              )}
            </div>
          </motion.div>
        )}

      {/* Divisor Visual */}
        <RevealOnScroll className="px-10 py-20 flex items-center gap-4">
           <div className="h-[1px] flex-1 bg-white/10"></div>
           <span className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.6em] italic">Nórica</span>
           <div className="h-[1px] flex-1 bg-white/10"></div>
        </RevealOnScroll>

        {/* Modules Section */}
        <div className="cards-grid px-6 mt-4 space-y-6 max-w-md mx-auto relative">
          

          <HojeCards />

          {/* O Porto */}
          <RevealOnScroll
            style={{ '--card-index': 0 } as React.CSSProperties}
            onClick={(e) => handleNavigate(e, '/porto/')}
            className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-colors relative card-lite cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center"
          >            {/* SVG Snake Border */}
            <SnakeBorder index={0} color="#60A5FA" />
            {/* Gap Line to next card */}
            <SnakeGap index={0} />
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0"><div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" /></div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20 group-hover:rotate-6 transition-transform relative z-10">
                <LifeBuoy size={32} className="text-white" />
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">DIÁRIO EMOCIONAL & REFLEXÃO</p>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">O Porto</h2>
              </div>
              <p className="text-white/70 text-sm font-bold leading-relaxed px-4 opacity-80 group-hover:opacity-100 transition-opacity relative z-10">
                Seu cais seguro para realizar sua reflexão diária e registrar seus insights emocionais. Um espaço de autoconhecimento e total privacidade.
              </p>
            </div>
          </RevealOnScroll>

          {/* A Arena */}
          <RevealOnScroll
            style={{ '--card-index': 1 } as React.CSSProperties}
            onClick={(e) => handleNavigate(e, '/arena/')}
            className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-colors relative card-lite cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center"
          >            {/* SVG Snake Border */}
            <SnakeBorder index={1} color="#FB7185" />
            {/* Gap Line to next card */}
            <SnakeGap index={1} />
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            </div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-600 to-rose-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20 group-hover:-rotate-6 transition-transform relative z-10">
                <Sword size={32} className="text-white" />
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">SIMULADOR TÁTICO</p>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">A Arena</h2>
              </div>
              <p className="text-white/70 text-sm font-bold leading-relaxed px-4 opacity-80 group-hover:opacity-100 transition-opacity relative z-10">
                O convés de treinamento para a vida. Pratique diálogos difíceis e simule conexões com especialistas em ambiente seguro.
              </p>
            </div>
          </RevealOnScroll>

          {/* O Farol */}
          <RevealOnScroll
            style={{ '--card-index': 2 } as React.CSSProperties}
            onClick={(e) => handleNavigate(e, '/farol/')}
            className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-colors relative card-lite cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center"
          >
            {/* SVG Snake Border */}
            <SnakeBorder index={2} color="#34D399" />
            {/* Gap Line to next card */}
            <SnakeGap index={2} />
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            </div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20 group-hover:rotate-12 transition-transform relative z-10">
                <LighthouseIcon size={32} className="text-white" />
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">ILUMINANDO O CAMINHO</p>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">O Farol</h2>
              </div>
              <p className="text-white/70 text-sm font-bold leading-relaxed px-4 opacity-80 group-hover:opacity-100 transition-opacity relative z-10">
                Encontre direção nos momentos de névoa. Orientação e luz para quando você não souber qual direção navegar.
              </p>
            </div>
          </RevealOnScroll>

          {/* O Cofre */}
          <RevealOnScroll
            style={{ '--card-index': 3 } as React.CSSProperties}
            onClick={(e) => handleNavigate(e, '/cofre/')}
            className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-colors relative card-lite cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center"
          >
            {/* SVG Snake Border */}
            <SnakeBorder index={3} color="#2DD4BF" />
            {/* Gap Line to next card */}
            <SnakeGap index={3} />
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            </div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-teal-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20 group-hover:rotate-6 transition-transform relative z-10">
                <Shield size={32} className="text-white" />
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">SIGILO ABSOLUTO</p>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">O Cofre</h2>
              </div>
              <p className="text-white/70 text-sm font-bold leading-relaxed px-4 opacity-80 group-hover:opacity-100 transition-opacity relative z-10">
                Suas memórias mais preciosas sob tranca e chave. Um baú digital que só você pode acessar.
              </p>
            </div>
          </RevealOnScroll>

          {/* Logs */}
          <RevealOnScroll
            style={{ '--card-index': 4 } as React.CSSProperties}
            onClick={(e) => handleNavigate(e, '/log/')}
            className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-colors relative card-lite cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center"
          >
            {/* SVG Snake Border */}
            <SnakeBorder index={4} color="#38BDF8" />
            {/* Gap Line to next card */}
            
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            </div>
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-sky-600 to-sky-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-sky-500/20 group-hover:rotate-6 transition-transform relative z-10">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">DIÁRIO DE BORDO</p>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Logs</h2>
              </div>
              <p className="text-white/70 text-sm font-bold leading-relaxed px-4 opacity-80 group-hover:opacity-100 transition-opacity relative z-10">
                O registro histórico do seu mapeamento de hábitos e reflexão diária. Acompanhe cada milha na sua jornada.
              </p>
            </div>
          </RevealOnScroll>

          <NoiteCard />

          {/* Respiração Section */}
          <RevealOnScroll
            style={{ '--card-index': 5 } as React.CSSProperties}
            onClick={(e) => handleNavigate(e, '/respiracao/')}
            className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-colors relative card-lite overflow-hidden cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center space-y-6"
          >            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black text-sky-400 uppercase tracking-[0.4em]">RESPIRAÇÃO & FOCO</p>
            </div>
            
            <div className="flex flex-col items-center pt-4 relative z-10">
              <div
                className="w-52 h-52 rounded-full bg-white/5 border border-white/15 flex items-center justify-center relative overflow-hidden shadow-2xl mx-auto breathe-scale"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 to-transparent opacity-40" />
                
                {/* Compass Icon with rotating needle effect */}
                <div className="relative z-10 w-24 h-24 flex items-center justify-center">
                  <Compass className="text-sky-400 opacity-55 absolute" size={80} strokeWidth={1} />
                  <div className="relative spin-10s">
                    <div className="w-1 h-12 bg-gradient-to-t from-sky-400 to-transparent rounded-full" />
                  </div>
                  <div className="absolute w-2 h-2 bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
                </div>
              </div>
              <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest mt-10 opacity-80 italic">Respire no ritmo do círculo e desacelere</p>
            </div>
          </RevealOnScroll>
        </div>
      </motion.div>
      <RodaEmocoes
        mood={feelingFor}
        onClose={() => setFeelingFor(null)}
        onDone={(mood, feeling, talk) => {
          setFeelingFor(null);
          logMood(mood, feeling).catch(() => {});
          if (talk) router.push(`/porto/?humor=${mood}${feeling ? `&sentimento=${encodeURIComponent(feeling)}` : ''}`);
          else { setWidgetToast(mood); setTimeout(() => setWidgetToast(null), 6000); }
        }}
      />
      {/* Confirmação da pérola marcada pelo widget */}
      <AnimatePresence>
        {habitToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            data-testid="habit-toast"
            className="fixed top-[calc(env(safe-area-inset-top)+1rem)] inset-x-4 z-[200] max-w-md mx-auto bg-[#0b0f19]/95 border border-sky-400/30 rounded-[2rem] p-5 shadow-2xl"
          >
            <p className="text-sm font-black text-white">
              {habitToast.fresh ? <>Pérola do dia: <span className="text-sky-300">{habitToast.label}</span> ✓</> : <>&quot;{habitToast.label}&quot; já estava marcado hoje 💙</>}
            </p>
            <button onClick={() => { setHabitToast(null); router.push('/log/'); }} className="mt-3 text-[10px] font-black text-sky-300 uppercase tracking-widest underline underline-offset-4">Ver meus Logs</button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Confirmação do humor marcado pelo widget */}
      <AnimatePresence>
        {widgetToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-[calc(env(safe-area-inset-top)+1rem)] inset-x-4 z-[200] max-w-md mx-auto bg-[#0b0f19]/95 border border-emerald-500/30 rounded-[2rem] p-5 shadow-2xl"
          >
            <p className="text-sm font-black text-white">Seu mar foi registrado: <span className="text-emerald-400 capitalize">{widgetToast}</span> ✓</p>
            {widgetToast !== 'calmo' ? (
              <button onClick={() => { setWidgetToast(null); router.push(`/porto/?humor=${widgetToast}`); }} className="mt-3 text-[10px] font-black text-emerald-400 uppercase tracking-widest underline underline-offset-4">
                Quer conversar com a Nórica?
              </button>
            ) : (
              <p className="text-xs text-white/50 font-semibold mt-1">Que bom. Aproveite a maré mansa. 🌊</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {mostrarNeblina && (
        <NeblinaSOS 
          onClareou={() => {
            setMostrarNeblina(false);
            router.push('/porto/?humor=neblina');
          }} 
        />
      )}
    </main>
  );
}

  return (
    <main className="fixed inset-0 w-full h-full flex items-center justify-center p-4 md:p-8 overflow-y-auto overflow-x-hidden bg-[#080d19] selection:bg-emerald-500/30 overscroll-none">
      <LoginBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] mx-auto relative z-10"
      >
        <div className="text-center mb-8 relative">
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-md">
            Porto Seguro
          </h1>
          <p className="text-emerald-500/80 font-bold text-[10px] uppercase tracking-[0.3em] mt-3">Nórica • Seu porto seguro</p>
        </div>

        <div className="w-full bg-[#0d1424]/80 backdrop-blur-md rounded-3xl p-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-20 flex">
            <svg className="absolute inset-0 w-full h-full block overflow-visible" xmlns="http://www.w3.org/2000/svg">
              <rect
                x="0" y="0" width="100%" height="100%" rx="24" fill="none" stroke="#00D88B" strokeWidth="4"
                pathLength={100}
                className="snake-loop"
              />
            </svg>
          </div>
          {/* Subtle top glow line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D88B]/50 to-transparent" />

          <motion.div 
            className="space-y-6 relative z-10"
            variants={loginContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Google Button */}
            <motion.div variants={loginItemVariants}>
              <motion.button 
              whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin} 
              disabled={googleLoading} 
              className="w-full h-[50px] bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 font-bold text-[11px] text-white transition-all shadow-sm active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              CONTINUAR COM GOOGLE
              </motion.button>
            </motion.div>

            <motion.div variants={loginItemVariants} className="flex items-center gap-3 py-2">
              <div className="flex-1 h-[1px] bg-white/10" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Ou acesse com e-mail</span>
              <div className="flex-1 h-[1px] bg-white/10" />
            </motion.div>

            <form onSubmit={handleLogin} className="space-y-4">
              <motion.div variants={loginItemVariants} className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#00D88B] transition-colors" size={18} />
                <input 
                  type="email" 
                  placeholder="Seu E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[50px] bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 text-sm text-white outline-none focus:border-[#00D88B]/60 focus:bg-black/50 transition-all placeholder:text-white/30"
                />
              </motion.div>

              <motion.div variants={loginItemVariants} className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#00D88B] transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Sua Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[50px] bg-black/30 border border-white/10 rounded-xl pl-12 pr-12 text-sm text-white outline-none focus:border-[#00D88B]/60 focus:bg-black/50 transition-all placeholder:text-white/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </motion.div>

              <motion.div variants={loginItemVariants} className="flex justify-between items-center px-1 py-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative w-4 h-4 rounded-md bg-black/40 border border-white/20 flex items-center justify-center transition-all group-hover:border-[#00D88B]/60">
                    <input type="checkbox" className="peer absolute opacity-0 w-full h-full cursor-pointer" />
                    <div className="w-2 h-2 rounded-[2px] bg-[#00D88B] opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] font-bold text-white/60 group-hover:text-white/90 transition-colors">Lembrar de mim</span>
                </label>
                <button 
                  type="button"
                  onClick={() => router.push('/auth/forgot-password/')}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </motion.div>

              {error && (
                <motion.div 
                  variants={loginItemVariants}
                  className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-[11px] font-bold text-center"
                >
                  {error}
                </motion.div>
              )}

              <motion.div variants={loginItemVariants}>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                type="submit" 
                disabled={loading}
                className="w-full h-[54px] bg-[#00D88B] hover:bg-emerald-400 rounded-xl flex items-center justify-center gap-2 font-black text-[12px] text-[#080d19] transition-all shadow-[0_5px_20px_rgba(0,216,139,0.25)] uppercase tracking-wider"
              >
                  {loading ? "Conectando..." : "Entrar"}
                  <ArrowRight size={16} />
                </motion.button>
              </motion.div>
            </form>

            <motion.div variants={loginItemVariants} className="text-center pt-6">
              <span className="text-[11px] font-medium text-white/50">Não tem uma conta? </span>
              <button 
                type="button"
                onClick={() => router.push('/auth/signup/')}
                className="text-[11px] font-bold text-white hover:text-[#00D88B] transition-colors ml-1"
              >
                Criar conta
              </button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </main>
  );
}

const loginContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const loginItemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

