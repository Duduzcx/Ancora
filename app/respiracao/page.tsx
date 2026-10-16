"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Compass, Wind, ShieldAlert, Moon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import SonsAmbiente from '@/components/SonsAmbiente';

type Phase = 'inspira' | 'prende' | 'expira';

const PHASE_CONFIGS = {
  inspira: {
    title: "Inspira",
    subtitle: "Inspire ar suavemente",
    color: "text-emerald-400",
    bgGradient: "from-emerald-500/20 to-teal-500/5",
    glowColor: "rgba(16, 185, 129, 0.6)"
  },
  prende: {
    title: "Prende",
    subtitle: "Prenda a respiração e concentre-se",
    color: "text-cyan-400",
    bgGradient: "from-cyan-500/20 to-blue-500/5",
    glowColor: "rgba(34, 211, 238, 0.6)"
  },
  expira: {
    title: "Expira",
    subtitle: "Expire o ar lentamente",
    color: "text-sky-400",
    bgGradient: "from-sky-500/15 to-indigo-500/5",
    glowColor: "rgba(14, 165, 233, 0.4)"
  }
};

export default function RespiracaoPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('inspira');
  const [timeLeft, setTimeLeft] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (phase === 'inspira') {
            setPhase('prende');
            return 7;
          } else if (phase === 'prende') {
            setPhase('expira');
            return 8;
          } else {
            setPhase('inspira');
            return 4;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const config = PHASE_CONFIGS[phase];

  const getOrbeAnimation = () => {
    switch (phase) {
      case 'inspira':
        return {
          scale: 1.6,
          boxShadow: `0 0 80px ${config.glowColor}, inset 0 0 30px rgba(16, 185, 129, 0.3)`,
          borderColor: 'rgba(52, 211, 153, 0.5)',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          transition: { duration: 4, ease: "easeInOut" }
        };
      case 'prende':
        return {
          scale: 1.6,
          boxShadow: `0 0 100px ${config.glowColor}, inset 0 0 45px rgba(34, 211, 238, 0.4)`,
          borderColor: 'rgba(34, 211, 238, 0.6)',
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          transition: { duration: 7, ease: "easeInOut" }
        };
      case 'expira':
        return {
          scale: 1.0,
          boxShadow: `0 0 40px ${config.glowColor}, inset 0 0 15px rgba(14, 165, 233, 0.1)`,
          borderColor: 'rgba(14, 165, 233, 0.3)',
          backgroundColor: 'rgba(14, 165, 233, 0.03)',
          transition: { duration: 8, ease: "easeInOut" }
        };
    }
  };

  const getAuraAnimation = () => {
    switch (phase) {
      case 'inspira':
        return {
          scale: 2.2,
          opacity: 0.3,
          transition: { duration: 4, ease: "easeInOut" }
        };
      case 'prende':
        return {
          scale: 2.25,
          opacity: 0.4,
          transition: { duration: 7, ease: "easeInOut" }
        };
      case 'expira':
        return {
          scale: 1.0,
          opacity: 0.08,
          transition: { duration: 8, ease: "easeInOut" }
        };
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#021013] relative flex flex-col items-center justify-between overflow-x-hidden py-12 px-6 select-none font-sans">
      <AnimatedBackground subtle={true} />
      
      {/* Background radial soft ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(4,47,46,0.5)_0%,transparent_70%)] pointer-events-none z-0" />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md flex flex-col justify-between items-center h-full flex-1 z-10"
      >
        {/* Header Navigation */}
        <div className="w-full flex items-center justify-between relative shrink-0 pt-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/')}
            className="p-3 bg-white/5 border border-white/10 backdrop-blur-md rounded-full text-teal-400 hover:bg-white/10 active:scale-95 transition-all shadow-lg shadow-black/20"
            title="Voltar para a Página Inicial"
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-teal-500/80 uppercase tracking-[0.25em]">Ciclo de Foco Ativo</span>
            <span className="text-xs font-bold text-white/60">Pausa de Concentração 4-7-8</span>
          </div>
        </div>

        {/* Central Display: Orbe & Countdown */}
        <div className="relative flex items-center justify-center w-full aspect-square my-auto max-w-[280px] sm:max-w-[320px]">
          {/* Outer glowing aura ring */}
          <motion.div
            animate={getAuraAnimation()}
            className="absolute w-52 h-52 sm:w-60 sm:h-60 bg-teal-400/20 rounded-full blur-[60px] pointer-events-none"
          />

          {/* Technological breathing circle */}
          <motion.div
            animate={getOrbeAnimation()}
            className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border flex flex-col items-center justify-center relative backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            {/* Spinning radar lines */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-2 border border-dashed border-teal-500/10 rounded-full pointer-events-none"
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center space-y-1 relative z-10"
              >
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${config.color}`}>
                  {config.title}
                </span>
                
                <span className="text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  {timeLeft}s
                </span>
                
                <Wind size={16} className={`${config.color} opacity-60 mt-1 animate-pulse`} />
              </motion.div>
            </AnimatePresence>
            
            {/* Compass rotating needle effect as technical backdrop */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
              <Compass size={140} strokeWidth={1} />
            </div>
          </motion.div>
        </div>

        {/* Text Guidance & Steps Indicator */}
        <div className="w-full text-center space-y-6 shrink-0 pb-6">
          <div className="h-12 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                className="space-y-1"
              >
                <p className="text-white text-base font-bold tracking-tight">
                  {config.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Staggered progress bar for the technique */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-xs mx-auto backdrop-blur-md shadow-inner flex justify-around items-center gap-3">
            {[
              { id: 'inspira', label: 'Inspira', duration: '4s' },
              { id: 'prende', label: 'Foque', duration: '7s' },
              { id: 'expira', label: 'Expira', duration: '8s' }
            ].map((step) => {
              const isActive = phase === step.id;
              return (
                <div 
                  key={step.id} 
                  className={`flex flex-col items-center space-y-1 transition-all duration-300 ${isActive ? 'scale-105 opacity-100' : 'opacity-40'}`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? PHASE_CONFIGS[step.id as Phase].color : 'text-white'}`}>
                    {step.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-white/50">{step.duration}</span>
                  </div>
                  {isActive && (
                    <motion.div 
                      layoutId="activeDot"
                      className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-1 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="max-w-xs mx-auto w-full touch-auto text-left">
            <SonsAmbiente compact />
          </div>
          <button onClick={() => router.push('/noite/')} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300/80">
            <Moon size={12} /> Sem sono? Modo noite
          </button>
        </div>
      </motion.div>
    </main>
  );
}
