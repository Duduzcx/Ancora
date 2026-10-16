"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, Sparkles, MessageSquare, ArrowLeft, 
  Target, TrendingUp, CheckCircle2, ShieldAlert,
  ArrowRight, Anchor, Compass, Zap, Waves,
  ShieldCheck, Star, Ship, BarChart3, Map,
  Activity, Radio
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AnimatedBackground from '@/components/AnimatedBackground';
import { createClient } from '@/lib/supabase-client';
import { firstName } from '@/lib/user-name';
import { cachedPlan, refreshPlan } from '@/lib/norica-api';
import { getAuthState } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { loadFarolReading, EMPTY_FAROL, type FarolReading } from '@/lib/farol';

export default function FarolPage() {
  const [progress, setProgress] = useState<number>(0);
  const [userName, setUserName] = useState("Amigo");
  const [isMounted, setIsMounted] = useState(false);
  const [timeState, setTimeState] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const [dailyLog, setDailyLog] = useState<any>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [reading, setReading] = useState<FarolReading>(EMPTY_FAROL);

  useEffect(() => {
    setIsMounted(true);
    
    // Ajuste da StatusBar para tema escuro
    const setDarkStatus = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setBackgroundColor({ color: '#020617' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {}
    };
    setDarkStatus();

    // Carregamento inicial do progresso
    const loadProgress = () => {
      const savedProgress = localStorage.getItem('norica-progress');
      setProgress(savedProgress !== null ? parseFloat(savedProgress) : 0);
    };
    
    loadProgress();

    const hour = new Date().getHours();
    if (hour < 12) setTimeState("Manhã");
    else if (hour < 18) setTimeState("Tarde");
    else setTimeState("Noite");

    // Tudo em paralelo e com cache no aparelho: o Farol aparece na hora com a última
    // leitura e atualiza quando o servidor responde (antes cada consulta esperava a anterior).
    const load = async () => {
      const user = getAuthState().user ?? (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;
      const uid = user.id;
      const today = new Date().toLocaleDateString('en-CA');
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceKey = since.toLocaleDateString('en-CA');
      const cutoff = (pro: boolean) => {
        const d = new Date();
        d.setDate(d.getDate() - (pro ? 30 : 7));
        return d.toLocaleDateString('en-CA');
      };

      // 1) Na hora: o que já estava salvo no aparelho.
      setUserName(firstName(user, cacheGet<string>(uid, 'profileName')));
      let pro = cachedPlan(uid)?.effective === 'pro';
      setIsPro(pro);
      const cachedMonth = cacheGet<any[]>(uid, 'farolMonth');
      if (cachedMonth) setWeeklyLogs(cachedMonth.filter((l) => l.date >= cutoff(pro)));
      const cachedToday = cacheGet<any>(uid, 'farolToday');
      if (cachedToday?.date === today) setDailyLog(cachedToday);
      const cachedReading = cacheGet<FarolReading>(uid, 'farolReading');
      if (cachedReading) setReading(cachedReading);

      // 2) Em paralelo: servidor.
      let monthLogs: any[] = cachedMonth ?? [];
      supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle()
        .then(({ data }) => {
          if (data?.display_name) {
            setUserName(firstName(user, data.display_name));
            cacheSet(uid, 'profileName', data.display_name);
          }
        });
      supabase.from('daily_logs').select('*').eq('user_id', uid).gte('date', sinceKey)
        .order('date', { ascending: true })
        .then(({ data }) => {
          if (!data) return;
          monthLogs = data;
          cacheSet(uid, 'farolMonth', data);
          setWeeklyLogs(data.filter((l: any) => l.date >= cutoff(pro)));
          const t = data.find((l: any) => l.date === today) ?? null;
          setDailyLog(t);
          cacheSet(uid, 'farolToday', t);
        });
      // Plano Pro vê as marés dos últimos 30 dias; o Gratuito, 7.
      refreshPlan(uid)
        .then((plan) => {
          pro = plan.effective === 'pro';
          setIsPro(pro);
          setWeeklyLogs(monthLogs.filter((l) => l.date >= cutoff(pro)));
        })
        .catch(() => {});
      loadFarolReading()
        .then((r) => { setReading(r); cacheSet(uid, 'farolReading', r); })
        .catch(() => {});
    };
    load();

    // Listener para mudanças no localStorage caso o usuário complete algo em outra aba (raro mas bom ter)
    window.addEventListener('storage', loadProgress);
    return () => window.removeEventListener('storage', loadProgress);
  }, [supabase]);

  if (!isMounted) {
    return <div className="min-h-[100dvh] bg-[#020617]"></div>;
  }

  const getStatusData = () => {
    let baseStatus = {
      title: "Radar de Início",
      message: `${userName}, Nórica detectou águas calmas até demais. Que tal agitar um pouco com o primeiro hábito do dia?`,
      trigger: "ajuda para começar meu dia",
      glow: "shadow-blue-500/20",
      energy: "Em Espera",
      flow: "Estático",
      isFoggy: false
    };

    if (progress > 0 && progress < 50) {
      baseStatus = { ...baseStatus, title: "Sinal de Movimento", message: `O radar detectou seus primeiros passos, ${userName}. Continue navegando.`, trigger: "motivação para continuar", glow: "shadow-emerald-500/20", energy: "Ativando", flow: "Oscilante", isFoggy: false };
    } else if (progress >= 50 && progress < 100) {
      baseStatus = { ...baseStatus, title: "Navegação Estável", message: `Você está quase lá, ${userName}. O radar mostra que solo firme está a poucos nós de distância.`, trigger: "foco para terminar o dia", glow: "shadow-emerald-500/40", energy: "Otimizada", flow: "Harmônico", isFoggy: false };
    } else if (progress === 100) {
      baseStatus = { ...baseStatus, title: "Vitória Nórica", message: `Missão cumprida! Seu ecossistema está em equilíbrio perfeito hoje.`, trigger: "celebrar minhas vitórias", glow: "shadow-amber-500/40", energy: "Plena", flow: "Total", isFoggy: false };
    }

    if (dailyLog) {
      if (dailyLog.conselho) {
        baseStatus.message = dailyLog.conselho;
      }
      if (dailyLog.humor === 'ansioso' || dailyLog.humor === 'agitado') {
        if (progress === 100) {
          baseStatus.title = "Atenção Carinhosa";
        } else {
          baseStatus.title = "Mar Agitado";
        }
        baseStatus.glow = "shadow-rose-500/40";
        baseStatus.isFoggy = true;
        baseStatus.trigger = `lidar com ${dailyLog.assunto || 'ansiedade'}`;
      } else if (dailyLog.humor === 'sos') {
        baseStatus.title = "Sinal de SOS";
        baseStatus.glow = "shadow-red-500/60";
        baseStatus.isFoggy = true;
        baseStatus.trigger = "preciso de ajuda urgente para me acalmar";
      } else if (dailyLog.humor === 'calmo') {
        baseStatus.title = progress === 100 ? "Paz Total" : "Maré Calma";
        baseStatus.glow = "shadow-blue-500/30";
      }
    }

    return baseStatus;
  };

  const status = getStatusData();

  const getMoodValue = (humor: string) => {
    switch (humor) {
      case 'calmo': return 4;
      case 'ansioso': return 2;
      case 'agitado': return 1;
      case 'sos': return 0;
      default: return 3;
    }
  };

  const getMoodY = (humor: string) => {
    const val = getMoodValue(humor);
    return 90 - (val / 4) * 80; // Margem de 10% no topo e base
  };

  const generateTidePath = (logs: any[]) => {
    if (logs.length === 0) return "";
    if (logs.length === 1) return `M 0 ${getMoodY(logs[0].humor)} L 100 ${getMoodY(logs[0].humor)}`;
    
    let path = `M 0 ${getMoodY(logs[0].humor)}`;
    for (let i = 1; i < logs.length; i++) {
      const x = (i / (logs.length - 1)) * 100;
      const y = getMoodY(logs[i].humor);
      const prevX = ((i - 1) / (logs.length - 1)) * 100;
      const prevY = getMoodY(logs[i - 1].humor);
      const cp1X = prevX + (x - prevX) / 2;
      path += ` C ${cp1X} ${prevY}, ${cp1X} ${y}, ${x} ${y}`;
    }
    return path;
  };

  const displayLogs = weeklyLogs.length >= 2 ? weeklyLogs : [
    { humor: 'calmo', date: 'Simulação' }, 
    { humor: 'ansioso', date: 'Simulação' }, 
    { humor: 'agitado', date: 'Simulação' }, 
    { humor: 'calmo', date: 'Simulação' }
  ];

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto flex flex-col bg-transparent font-sans">
      <AnimatedBackground subtle={false} />
      <div className="flex-1 flex flex-col p-4 pt-8 space-y-6 max-w-7xl w-full mx-auto relative z-10">

      {/* Efeito de Radar e Neblina Dinâmica */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {status.isFoggy && (
          <div className="absolute inset-0 bg-[#cbd5e1]/10 backdrop-blur-[2px] animate-pulse mix-blend-overlay" />
        )}
        <div 
          className="absolute top-1/2 left-1/2 w-[200%] h-[200%] bg-gradient-to-tr from-emerald-500/5 via-transparent to-transparent opacity-20 animate-radar"
          style={{ willChange: 'transform' }}
        />
      </div>

      <div className="max-w-7xl w-full relative z-10 space-y-8 pb-12">
        
        {/* NAV BAR (Desktop) */}
        <div className="hidden lg:flex items-center justify-between bg-white/5 backdrop-blur-3xl p-6 rounded-[3rem] border border-white/10 shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-950 border border-white/10 text-white rounded-2xl shadow-lg">
                <Radio size={20} className="text-emerald-500 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black text-emerald-400 tracking-tighter uppercase italic leading-none">Nórica</h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Centro de Inteligência</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex px-6 py-2 bg-slate-950 border border-white/10 text-white rounded-full text-xs font-black uppercase tracking-widest gap-2">

              Monitoramento Ativo
            </div>
          </div>
        </div>

        {/* HUD PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={`lg:col-span-8 bg-white/5 backdrop-blur-3xl rounded-[4rem] p-10 md:p-16 border border-white/10 shadow-2xl relative overflow-hidden group ${status.glow}`}
          >
            <div className="relative z-10 space-y-10">
              <div className="flex items-center gap-4">
                <div className={`px-5 py-2 rounded-full bg-slate-950 border border-white/10 text-emerald-400 text-xs font-black uppercase tracking-[0.3em] shadow-lg`}>
                  {status.title}
                </div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <h1 className="text-5xl md:text-8xl font-black text-white leading-[0.85] tracking-tighter">
                Navegação <br /> em <span className="text-emerald-400 italic">Solo Firme.</span>
              </h1>

              <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 hover:bg-white/10 transition-all duration-500">
                <p className="text-xl md:text-3xl text-slate-300 font-bold leading-tight">
                  "{status.message}"
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center w-full gap-4 mt-8">
                <Link href="/log" className="w-full sm:w-auto">
                  <motion.button whileHover={{ scale: 1.05, y: -5 }} className="w-full sm:w-auto justify-center px-10 py-6 bg-slate-900 hover:bg-slate-800 text-white rounded-[2.5rem] font-black flex items-center gap-4 shadow-2xl border border-white/10 transition-all text-sm">
                    <Map size={24} className="text-emerald-400" />
                    Abrir Registro Nórica
                  </motion.button>
                </Link>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(`/porto/?prompt=${encodeURIComponent(`Nórica, quero ${status.trigger}.`)}`)}
                  className="w-full sm:w-auto justify-center px-10 py-6 bg-emerald-500 text-slate-950 rounded-[2.5rem] font-black flex items-center gap-4 shadow-2xl shadow-emerald-500/20 hover:bg-emerald-400 transition-all text-sm relative overflow-hidden"
                >
                  <MessageSquare size={24} className="relative z-10" />
                  <span className="relative z-10">Refletir agora</span>
                </motion.button>
              </div>
            </div>

            <div className="absolute -bottom-20 -right-20 text-white/5 opacity-5 pointer-events-none">
              <Compass size={400} strokeWidth={0.5} />
            </div>
          </motion.div>

          <div className="lg:col-span-4 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ willChange: 'transform, opacity' }}
              className="bg-white/5 backdrop-blur-md rounded-[4rem] p-10 text-white shadow-2xl relative overflow-hidden border border-white/10"
            >

              {/* Ícone Target Animado como Radar */}
              <motion.div 
                className="absolute top-8 right-8 text-emerald-500/30 pointer-events-none"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                style={{ willChange: 'transform, opacity' }}
              >
                <Target size={120} strokeWidth={1} />
              </motion.div>
              
              <div className="relative z-10 space-y-12">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.4em]">Apoio Reflexivo</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-7xl md:text-8xl font-black tabular-nums tracking-tighter">{Math.round(progress)}</span>
                    <span className="text-2xl font-black text-emerald-400 mb-2">%</span>
                  </div>
                </div>

                <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: `${progress}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                    className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)]"
                  />
                </div>

                <div className="space-y-4 pt-4">
                  <HUDItem icon={Zap} label="Mapeamento de Hábitos" value={status.energy} />
                  <HUDItem icon={Waves} label="Insights Emocionais" value={status.flow} />
                </div>
              </div>
            </motion.div>

            {/* Gráfico de Marés */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white/5 backdrop-blur-md rounded-[3rem] p-8 text-white shadow-2xl relative border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <Activity size={20} className="text-emerald-400" />
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">Marés ({isPro ? 30 : 7} Dias)</h3>
              </div>
              <div className="w-full h-24 relative flex items-end justify-between">
                <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path 
                    d={generateTidePath(displayLogs)} 
                    fill="none" 
                    stroke="#34d399" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {displayLogs.map((log, i) => {
                  const x = (i / Math.max(1, displayLogs.length - 1)) * 100;
                  const y = getMoodY(log.humor);
                  return (
                    <div 
                      key={i} 
                      className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_10px_#fff]" 
                      style={{ left: `calc(${x}% - 6px)`, top: `calc(${y}% - 6px)` }} 
                      title={`${log.date}: ${log.humor}`} 
                    />
                  );
                })}
              </div>
            </motion.div>

            {/* Exercício de Respiração 4-7-8 */}
            <RespiracaoFarolConsertada />
          </div>
        </div>

        {/* BOTTOM CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InsightCard icon={Compass} title="Norte" desc={reading.insights.norte} index={0} />
          <InsightCard icon={Star} title="Brilho" desc={reading.insights.brilho} index={1} />
          <InsightCard icon={ShieldCheck} title="Proteção" desc={reading.insights.protecao} index={2} />
          <InsightCard icon={BarChart3} title="Tendência" desc={reading.insights.tendencia} index={3} />
        </div>
      </div>
      </div>

      {/* ESPAÇADOR DE SEGURANÇA PARA O MENU */}
      <div className="h-[80px] w-full flex-shrink-0"></div>
    </div>
  );
}

function HUDItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center justify-between p-5 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all group">
      <div className="flex items-center gap-4">
        <div className="text-emerald-400 group-hover:scale-110 transition-transform">
          <Icon size={18} />
        </div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xs font-black text-emerald-400">{value}</span>
    </div>
  );
}

function InsightCard({ icon: Icon, title, desc, index }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: 0.3 + (index * 0.1) }}
      style={{ willChange: 'transform, opacity' }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="bg-white/5 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-xl space-y-4 hover:shadow-2xl transition-all"
    >
      <div className="w-12 h-12 bg-slate-950 border border-white/10 text-emerald-400 rounded-2xl flex items-center justify-center shadow-lg">
        <Icon size={24} />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-tight">{title}</h3>
        <p className="text-sm text-slate-400 font-bold leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}


export function RespiracaoFarolConsertada() {
  const [fase, setFase] = useState('parado'); // 'parado' ou 'rodando'
  const [tempo, setTempo] = useState(0);
  const [subFase, setSubFase] = useState('inspira'); // 'inspira', 'segura', 'expira'

  useEffect(() => {
    if (fase === 'parado') {
      setTempo(0);
      return;
    }

    setSubFase('inspira');
    setTempo(4);

    const timer = setInterval(() => {
      setTempo((t) => {
        if (t <= 1) {
          let proximoTempo = 4;
          setSubFase((prev) => {
            if (prev === 'inspira') {
              proximoTempo = 7;
              return 'segura';
            } else if (prev === 'segura') {
              proximoTempo = 8;
              return 'expira';
            } else {
              proximoTempo = 4;
              return 'inspira';
            }
          });
          return proximoTempo;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fase]);

  return (
    <>
      {/* Card com as cores do App: Glassmorphism suave com overflow-hidden */}
      <div className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden">
        
        <h3 className="text-emerald-400 font-semibold mb-1 relative z-10 text-base">Tática 4-7-8</h3>
        <p className="text-slate-400 text-xs mb-6 text-center relative z-10 leading-relaxed">Recupere seu foco rapidamente</p>

        {/* Container da Bolha - REDUZIDO O TAMANHO GERAL */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-8">
          <motion.div 
            className={`absolute w-full h-full rounded-full bg-emerald-500/20 border border-emerald-400/50 will-change-transform`}
            animate={{
              scale: fase === 'parado' ? 1 : subFase === 'inspira' ? 1.25 : subFase === 'segura' ? 1.25 : 0.8,
              opacity: fase === 'parado' ? 0.5 : subFase === 'inspira' ? 1 : subFase === 'segura' ? 1 : 0.4,
            }}
            transition={{
              duration: fase === 'parado' ? 0.5 : subFase === 'inspira' ? 4 : subFase === 'segura' ? 7 : 8,
              ease: "easeInOut"
            }}
            style={{
              willChange: 'transform',
              boxShadow: '0 0 20px rgba(16,185,129,0.2)' // Brilho Emerald sutil
            }}
          ></motion.div>
          <span className="relative z-10 text-xl font-medium text-white drop-shadow-md">
            {fase !== 'parado' ? tempo : ''}
          </span>
        </div>

        <p className="text-emerald-300 font-medium h-6 mb-4 text-xs">
          {fase === 'rodando' && subFase === 'inspira' && 'Inspire profundamente...'}
          {fase === 'rodando' && subFase === 'segura' && 'Segure o ar...'}
          {fase === 'rodando' && subFase === 'expira' && 'Solte devagar...'}
          {fase === 'parado' && 'Pronto para começar?'}
        </p>

        {/* Botões com as cores do App */}
        {fase === 'parado' ? (
          <button onClick={() => setFase('rodando')} className="px-6 py-2 rounded-full bg-emerald-500 text-slate-950 font-medium active:scale-95 transition-all relative z-10 text-sm">
            Iniciar
          </button>
        ) : (
          <button onClick={() => setFase('parado')} className="px-6 py-2 rounded-full bg-slate-800 text-white font-medium active:scale-95 transition-all relative z-10 text-sm">
            Parar
          </button>
        )}
      </div>
    </>
  );
}
