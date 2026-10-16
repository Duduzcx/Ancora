"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, Apple, Wind, Smartphone, Sun, Bed, 
  CheckCircle2, Circle, ArrowLeft, Anchor, Sparkles, 
  RefreshCcw, Heart, ShowerHead, Shirt, Pill, 
  StretchHorizontal, PenLine, VolumeX, Monitor, 
  UtensilsCrossed, Trash2, MessageCircle, Music, 
  MapPin, ShieldOff, LifeBuoy, Fish, Leaf, Sprout, 
  Waves, Star, X, Menu
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StatusBar, Style } from '@capacitor/status-bar';
import Link from 'next/link';
import AnimatedBackground from '@/components/AnimatedBackground';
import { usePendingSync } from '@/lib/offline-sync';
import { fetchDailyLog, saveDailyLog, todayKey, noricaApi, type CustomTask } from '@/lib/norica-api';

// Tarefas sugeridas pela IA no Porto entram numa categoria própria.
const AI_CATEGORY = "Da Nórica" as const;

function withCustomTasks(base: Task[], completedIds: number[], custom: CustomTask[]): Task[] {
  const done = new Set(completedIds);
  return [
    ...base.map(t => ({ ...t, completed: done.has(t.id as number) })),
    ...custom.map(c => ({ id: c.id, category: AI_CATEGORY, text: c.text, completed: !!c.completed, icon: Sparkles })),
  ];
}

function toPayload(day: string, list: Task[], progress: number) {
  return {
    day,
    completed: list.filter(t => typeof t.id === 'number' && t.completed).map(t => t.id as number),
    custom_tasks: list.filter(t => t.category === AI_CATEGORY).map(t => ({ id: String(t.id), text: t.text, completed: t.completed })),
    progress,
  };
}

interface Task {
  id: number | string;
  category: "Corpo" | "Mente" | "Ambiente" | "Conexão" | "Da Nórica";
  text: string;
  completed: boolean;
  icon: any;
}

const defaultTasks: Task[] = [
  { id: 1, category: "Corpo", text: "Bebi água", completed: false, icon: Droplets },
  { id: 2, category: "Corpo", text: "Comi algo nutritivo", completed: false, icon: Apple },
  { id: 3, category: "Corpo", text: "Tomei banho", completed: false, icon: ShowerHead },
  { id: 4, category: "Corpo", text: "Vesti roupa limpa", completed: false, icon: Shirt },
  { id: 5, category: "Corpo", text: "Tomei medicamentos", completed: false, icon: Pill },
  { id: 6, category: "Corpo", text: "Fiz um alongamento", completed: false, icon: StretchHorizontal },
  { id: 7, category: "Mente", text: "Respirei fundo", completed: false, icon: Wind },
  { id: 8, category: "Mente", text: "Fiquei longe das telas", completed: false, icon: Smartphone },
  { id: 9, category: "Mente", text: "Anotei minhas reflexões", completed: false, icon: PenLine },
  { id: 10, category: "Mente", text: "Fiz 5 minutos de silêncio", completed: false, icon: VolumeX },
  { id: 11, category: "Mente", text: "Reconheci o meu esforço", completed: false, icon: Heart },
  { id: 12, category: "Ambiente", text: "Abri a janela", completed: false, icon: Sun },
  { id: 13, category: "Ambiente", text: "Arrumei a cama", completed: false, icon: Bed },
  { id: 14, category: "Ambiente", text: "Organizei meu espaço", completed: false, icon: Monitor },
  { id: 15, category: "Ambiente", text: "Lavei a louça", completed: false, icon: UtensilsCrossed },
  { id: 16, category: "Ambiente", text: "Coloquei o lixo fora", completed: false, icon: Trash2 },
  { id: 17, category: "Conexão", text: "Falei com alguém", completed: false, icon: MessageCircle },
  { id: 18, category: "Conexão", text: "Escutei música boa", completed: false, icon: Music },
  { id: 19, category: "Conexão", text: "Saí de casa um pouco", completed: false, icon: MapPin },
  { id: 20, category: "Conexão", text: "Evitei conflitos", completed: false, icon: ShieldOff },
  { id: 21, category: "Conexão", text: "Pedi ajuda se precisei", completed: false, icon: LifeBuoy },
];

const reflections = [
  "A calma não é a ausência de tempestade, mas a paz no meio dela.",
  "O que você faz hoje é o que mais importa para o seu amanhã.",
  "Seu esforço de hoje, por menor que pareça, é uma vitória.",
  "Respire. Você está fazendo o melhor que pode com o que tem.",
  "O mar se acalma após a tormenta. O mesmo acontece com a sua mente.",
  "Um mar calmo nunca fez um marinheiro habilidoso.",
  "As estrelas brilham mais forte na escuridão profunda do oceano.",
  "A Nórica não impede a tempestade, mas garante que você ainda esteja aqui quando ela passar.",
  "Você não pode controlar o vento, mas pode ajustar as suas velas.",
  "O Porto não é o fim da jornada, é onde você recupera as forças para o próximo horizonte.",
  "Cada onda que quebra na areia leva um pouco do peso que você carregava.",
  "Navegar é preciso; viver também é aprender a abraçar o impreciso.",
  "O Farol não grita; ele apenas brilha para quem busca encontrar o caminho.",
  "Mesmo nas noites sem lua, o oceano sabe para onde deve fluir. Confie no seu ritmo.",
  "Sua vulnerabilidade não é um vazamento no barco; é a água que te permite flutuar."
];



export default function LogPage() {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [pearls, setPearls] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showVictory, setShowVictory] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [currentReflection, setCurrentReflection] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [streak, setStreak] = useState(0);
  const pendingCount = usePendingSync();
  // Só avisa "salvo no aparelho" se o envio estiver demorando (evita piscar a cada toque).
  const [pendingSync, setPendingSync] = useState(0);
  useEffect(() => {
    if (!pendingCount) { setPendingSync(0); return; }
    const t = setTimeout(() => setPendingSync(pendingCount), 3000);
    return () => clearTimeout(t);
  }, [pendingCount]);
  // Se a pessoa marcar algo antes da conta responder, o que ela marcou vale mais.
  const touchedRef = React.useRef(false);
  const [aiInsight, setAiInsight] = useState<string>("");
  
  // Estados para valores aleatórios estáveis (evita erro de hidratação)
  const [particlePos, setParticlePos] = useState<{top: number, left: number}[]>([]);
  const [bubbleLefts, setBubbleLefts] = useState<number[]>([]);

  useEffect(() => {
    setIsMounted(true);
    
    // Ajuste da StatusBar para tema escuro
    const setDarkStatus = async () => {
      try {
        await StatusBar.setBackgroundColor({ color: '#021013' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {}
    };
    setDarkStatus();

    // Gera posições aleatórias apenas no cliente
    const isMobile = window.innerWidth < 768;
    setParticlePos([...Array(isMobile ? 8 : 20)].map(() => ({
      top: Math.random() * 100,
      left: Math.random() * 100
    })));
    setBubbleLefts([...Array(isMobile ? 5 : 10)].map(() => Math.random() * 100));

    // Lógica de reset diário e salvamento por data
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD estável
    const savedDate = localStorage.getItem('norica-last-date');

    try {
      if (savedDate !== today) {
        // Novo dia! Reseta as tarefas no estado e limpa o progresso
        setTasks(defaultTasks);
        localStorage.setItem('norica-last-date', today);
        localStorage.setItem('norica-tasks', JSON.stringify(defaultTasks));
        localStorage.setItem('norica-progress', '0');
        console.log("Nórica: Novo dia detectado. Logs resetados.");
      } else {
        const saved = localStorage.getItem('norica-tasks');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const merged = defaultTasks.map(dt => {
              const savedTask = parsed.find((st: any) => st.id === dt.id);
              return savedTask ? { ...dt, completed: savedTask.completed } : dt;
            });
            setTasks(merged);
          }
        }
      }

      // Inicializar ofensiva (streak)
      const savedStreak = parseInt(localStorage.getItem('norica-streak') || '0', 10);
      const lastLoggedDate = localStorage.getItem('norica-last-logged-date');
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
      
      let currentStreak = savedStreak;
      if (lastLoggedDate && lastLoggedDate !== today && lastLoggedDate !== yesterday) {
        currentStreak = 0; // Streak quebrado
        localStorage.setItem('norica-streak', '0');
      }
      setStreak(currentStreak);
    } catch (e) {
      console.error("Erro ao gerenciar tarefas diárias:", e);
    }

    // Sincroniza com a conta: o registro de hoje no Supabase vence a cópia local.
    fetchDailyLog(today)
      .then(log => {
        if (log && !touchedRef.current) setTasks(withCustomTasks(defaultTasks, log.completed || [], log.custom_tasks || []));
      })
      .catch(() => {})
      .finally(() => setIsSynced(true));
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const count = tasks.filter(t => t.completed).length;
    setPearls(count);
    const newProgress = tasks.length > 0 ? (count / tasks.length) * 100 : 0;
    setProgress(newProgress);
    
    localStorage.setItem('norica-tasks', JSON.stringify(tasks));
    localStorage.setItem('norica-progress', newProgress.toString());

    // Salva na conta (com pequeno atraso para juntar vários toques seguidos).
    if (isSynced) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const snapshot = toPayload(todayKey(), tasks, newProgress);
      saveTimer.current = setTimeout(() => { saveDailyLog(snapshot).catch(() => {}); }, 800);
    }

    // Lógica de Streak (Ofensiva)
    const today = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
    const lastLogged = localStorage.getItem('norica-last-logged-date');
    const currentStreak = parseInt(localStorage.getItem('norica-streak') || '0', 10);

    if (count > 0) {
      if (lastLogged !== today) {
        const newStreak = lastLogged === yesterday ? currentStreak + 1 : 1;
        localStorage.setItem('norica-streak', newStreak.toString());
        localStorage.setItem('norica-last-logged-date', today);
        localStorage.setItem('norica-prev-last-logged', lastLogged || '');
        setStreak(newStreak);
      }
    } else {
      if (lastLogged === today) {
        const prevLastLogged = localStorage.getItem('norica-prev-last-logged') || '';
        const newStreak = Math.max(0, currentStreak - 1);
        localStorage.setItem('norica-streak', newStreak.toString());
        if (prevLastLogged) {
          localStorage.setItem('norica-last-logged-date', prevLastLogged);
        } else {
          localStorage.removeItem('norica-last-logged-date');
        }
        localStorage.removeItem('norica-prev-last-logged');
        setStreak(newStreak);
      }
    }

    if (newProgress === 100 && !showVictory) {
      setTimeout(() => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        setShowVictory(true);
      }, 500);
    }
  }, [tasks, isMounted, showVictory, isSynced]);

  // Carregar/Gerar AI Insight (A cada 3 dias)
  useEffect(() => {
    if (!isMounted) return;
    
    const loadInsight = async () => {
      const cachedInsight = localStorage.getItem('norica-log-insight');
      const lastGeneratedTime = localStorage.getItem('norica-log-insight-time');
      
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      if (cachedInsight && lastGeneratedTime && (now - parseInt(lastGeneratedTime, 10)) < threeDaysInMs) {
        setAiInsight(cachedInsight);
      } else {
        try {
          
          // A frase é gerada no servidor (a chave da IA não fica mais no app).
          const completedTasks = tasks.filter(t => t.completed).map(t => t.text);
          const { insight } = await noricaApi.logInsight(completedTasks, progress);
          if (insight) {
            localStorage.setItem('norica-log-insight', insight);
            localStorage.setItem('norica-log-insight-time', now.toString());
            setAiInsight(insight);
            return;
          }
          throw new Error("API check failed or not set");
        } catch (err) {
          const fallbacks = [
            "Cada pequena reflexão concluída é um farol que guia seu bem-estar de volta ao porto seguro.",
            "Cuidar do seu bem-estar e hábitos é o primeiro passo para o autoconhecimento.",
            "A reflexão constante constrói a embarcação mais forte para os mares desafiadores da vida.",
            "A constância nas pequenas ações diárias é o que ancora seu bem-estar emocional.",
            "Você está navegando com autoconhecimento. Continue nutrindo seu ritmo no seu próprio tempo."
          ];
          const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
          localStorage.setItem('norica-log-insight', randomFallback);
          localStorage.setItem('norica-log-insight-time', now.toString());
          setAiInsight(randomFallback);
        }
      }
    };
    
    loadInsight();
  }, [isMounted, tasks]);

  const toggleTask = (id: number | string) => {
    touchedRef.current = true;
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const newState = !t.completed;
        if (newState) {
          setFeedback("Pérola coletada!");
          setTimeout(() => setFeedback(null), 1500);
        }
        return { ...t, completed: newState };
      }
      return t;
    }));
  };

  const openReflection = () => {
    const random = reflections[Math.floor(Math.random() * reflections.length)];
    setCurrentReflection(random);
    setShowReflection(true);
  };

  const categories: Task["category"][] = [
    ...(tasks.some(t => t.category === AI_CATEGORY) ? [AI_CATEGORY] : []),
    "Corpo", "Mente", "Ambiente", "Conexão",
  ];

  if (!isMounted) return null;

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden bg-transparent relative transition-all overscroll-none touch-pan-y">
      <AnimatedBackground subtle />
      
      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03] z-0">
        <Anchor size={800} strokeWidth={0.5} className="text-white" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "linear" }}
        className="flex-1 overflow-y-auto w-full custom-scrollbar overscroll-contain p-4 pt-[calc(env(safe-area-inset-top,64px)+3rem)] md:p-8 md:pt-32 lg:p-12 lg:pt-32 pb-24 relative z-10"
      >
        <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Status Section (Sem botão de voltar) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/5 backdrop-blur-2xl p-6 md:p-10 rounded-[3rem] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="flex flex-col text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Ecossistema de Hoje</h1>
            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mt-1">Status da sua Jornada</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {/* Display de Ofensiva (Streak) */}
            <div className="bg-white/5 border border-amber-500/20 rounded-3xl px-8 py-4 flex items-center gap-3 shadow-sm min-w-[150px]">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ofensiva</span>
                <span className="text-white font-black text-sm">
                  🔥 {streak} {streak === 1 ? 'Dia' : 'Dias'}
                </span>
              </div>
            </div>

            {/* Display de Data Automática */}
            <div className="bg-white/5 border border-white/10 rounded-3xl px-8 py-4 flex items-center gap-3 shadow-sm min-w-[200px]">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Diário de</span>
                <span className="text-white font-black text-sm">
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                {pendingSync > 0 && (
                  <span className="text-[9px] font-black text-amber-300/80 uppercase tracking-widest mt-1">
                    Salvo no aparelho · envia quando a internet voltar
                  </span>
                )}
              </div>
              <Sparkles size={16} className="text-emerald-400 ml-auto" />
            </div>

            <div className="bg-white/10 text-white px-8 py-4 rounded-3xl flex items-center gap-4 shadow-2xl border border-white/15">
              <div className="w-8 h-8 bg-blue-450 rounded-full flex items-center justify-center shadow-lg border border-blue-400/30">
                <div className="w-3 h-3 bg-white rounded-full opacity-80" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl leading-none">{pearls}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Pérolas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* VISUAL ECOSSISTEMA */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 h-[400px] md:h-[600px] bg-[#021418]/60 backdrop-blur-2xl rounded-[4rem] overflow-hidden shadow-2xl border-4 border-white/10 relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-slate-950/80 to-slate-950/90" />
            
            {/* Partículas estáveis */}
            {particlePos.map((pos: any, i: number) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-emerald-400 rounded-full log-particle"
                style={{ top: `${pos.top}%`, left: `${pos.left}%`, ['--d' as any]: `${3 + (i % 5)}s` }}
              />
            ))}

            <div className="absolute bottom-0 inset-x-0 h-32 bg-white/5 backdrop-blur-sm" />
            
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-emerald-500/20">
              <div className="log-anchor">
                <Anchor size={140} strokeWidth={1} className="opacity-40" />
              </div>
            </div>

            {/* Evolução Visual */}
            <AnimatePresence>
              {progress >= 20 && (
                <>
                  {[...Array(6)].map((_: any, i: number) => (
                    <motion.div
                      key={`p-${i}`}
                      initial={{ scale: 0, y: 50 }}
                      animate={{ scale: 1, y: 0 }}
                      className="absolute bottom-20 text-emerald-400/60"
                      style={{ left: `${15 + i * 14}%` }}
                    >
                      <div className="log-sway" style={{ ['--d' as any]: `${4 + i}s` }}>
                        <Sprout size={30 + i * 8} />
                      </div>
                    </motion.div>
                  ))}
                  {bubbleLefts.map((left: any, i: number) => (
                    <div
                      key={`b-${i}`}
                      className="absolute top-0 w-2 h-2 bg-white/30 rounded-full border border-white/20 log-bubble"
                      style={{ left: `${left}%`, ['--d' as any]: `${4 + (i % 4)}s`, ['--delay' as any]: `${i * 0.5}s` }}
                    />
                  ))}
                </>
              )}
              
              {progress >= 60 && (
                [...Array(4)].map((_: any, i: number) => (
                  <div
                    key={`f-${i}`}
                    className="absolute left-0 text-blue-400/40 log-fish"
                    style={{ top: `${25 + i * 15}%`, ['--d' as any]: `${15 + i * 2}s`, ['--delay' as any]: `${i * 4}s` }}
                  >
                    <Fish size={40} />
                  </div>
                ))
              )}

              {progress === 100 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-emerald-500/5 flex items-center justify-center"
                >
                  <div className="text-amber-400/10 log-sparkle">
                    <Sparkles size={300} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reflexão - Botão mais compacto no celular */}
            <div className="absolute bottom-6 md:bottom-12 inset-x-0 flex justify-center px-4 md:px-8">
              <motion.button
                disabled={pearls < 10}
                whileHover={pearls >= 10 ? { scale: 1.05, y: -5 } : {}}
                whileTap={pearls >= 10 ? { scale: 0.95 } : {}}
                onClick={openReflection}
                className={`
                  w-full py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3
                  ${pearls >= 10 
                    ? 'bg-amber-400 text-slate-950 border-b-4 border-amber-600 shadow-amber-500/20 hover:bg-amber-300' 
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'}
                `}
              >
                <Waves size={16} />
                {pearls >= 10 ? "Reflexão do Dia" : `Mais ${10 - pearls} pérolas`}
              </motion.button>
            </div>
          </div>

          {/* LISTA DE TAREFAS */}
          <div className="lg:col-span-7 space-y-10 pb-12">
            {aiInsight && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="p-6 bg-emerald-500/5 backdrop-blur-xl border border-emerald-500/20 rounded-3xl space-y-3 relative overflow-hidden shadow-[0_8px_32px_0_rgba(16,185,129,0.05)]"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.02] rounded-bl-full pointer-events-none" />
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Insight da Bússola (IA)</h3>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Sinal de Autocuidado</p>
                  </div>
                </div>
                <p className="text-sm text-white/90 leading-relaxed font-semibold italic">
                  "{aiInsight}"
                </p>
              </motion.div>
            )}

            {categories.map((cat) => (
              <div 
                key={cat} 
                className="space-y-6"
              >
                <div className="flex items-center gap-4 px-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] whitespace-nowrap">{cat}</h3>
                  <div className="h-px w-full bg-white/10" />
                </div>
                
                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.filter(t => t.category === cat).map((task) => (
                    <motion.div
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        group relative flex items-center gap-4 p-5 rounded-[2.5rem] border transition-all cursor-pointer overflow-hidden
                        ${task.completed 
                          ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400' 
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]'}
                      `}
                    >
                      <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500
                        ${task.completed ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-white/5 text-white/40'}
                      `}>
                        <task.icon size={20} />
                      </div>

                      <div className="flex-1">
                        <p className={`font-black text-base transition-all ${task.completed ? 'opacity-30 line-through text-white/45' : 'text-white'}`}>
                          {task.text}
                        </p>
                      </div>

                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all
                        ${task.completed ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-white/10'}
                      `}>
                        {task.completed && <CheckCircle2 size={16} />}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>

      {/* MODAL REFLEXÃO */}
      <AnimatePresence>
        {showReflection && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowReflection(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#031d22]/90 backdrop-blur-3xl rounded-[4rem] p-12 md:p-20 max-w-2xl w-full relative z-10 text-center space-y-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-white/10"
            >
              <div className="w-20 h-20 bg-amber-400 text-slate-950 rounded-3xl mx-auto flex items-center justify-center shadow-xl">
                <Sparkles size={40} />
              </div>
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.5em]">Sinal Captado</h2>
                <p className="text-2xl md:text-4xl font-black text-white tracking-tighter leading-tight italic">
                  "{currentReflection}"
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowReflection(false)}
                className="px-12 py-5 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-full font-black shadow-xl transition-colors"
              >
                Voltar à Jornada
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST FEEDBACK */}
      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] px-8 py-3 bg-blue-600 text-white font-black rounded-full shadow-2xl flex items-center gap-3"
          >
            <Star size={16} fill="white" />
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
