"use client";

// Conquistas da jornada: marcos de cuidado calculados a partir dos registros da pessoa.
// Nada de competição: celebram constância e coragem ("primeira conversa difícil treinada").

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Trophy, Waves, CalendarCheck, Flame, MessageCircleHeart, Mic, Heart, Sword, Footprints, ShieldCheck, Moon, Gem, Sun, Lock,
} from 'lucide-react';
import { noricaApi, type AchievementStats } from '@/lib/norica-api';
import { getAuthState } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';

type Badge = { id: string; title: string; desc: string; icon: any; goal: number; value: (s: AchievementStats) => number };

export const BADGES: Badge[] = [
  { id: 'mar-1', title: 'Primeira maré', desc: 'Marcou como está o seu mar', icon: Waves, goal: 1, value: (s) => s.moodCount },
  { id: 'porto-1', title: 'Cais seguro', desc: 'Primeira conversa no Porto', icon: MessageCircleHeart, goal: 1, value: (s) => s.chats },
  { id: 'seq-3', title: '3 dias seguidos', desc: 'Cuidou de você 3 dias seguidos', icon: Flame, goal: 3, value: (s) => s.bestStreak },
  { id: 'seq-7', title: '7 dias cuidando de você', desc: 'Uma semana inteira de constância', icon: Flame, goal: 7, value: (s) => s.bestStreak },
  { id: 'mar-7', title: 'Uma semana de mar', desc: 'Humor registrado em 7 dias', icon: CalendarCheck, goal: 7, value: (s) => s.moodDays },
  { id: 'voz-1', title: 'Diário falado', desc: 'Primeiro diário por voz', icon: Mic, goal: 1, value: (s) => s.voice },
  { id: 'gratidao-3', title: 'Olhar grato', desc: '3 listas de coisas boas', icon: Heart, goal: 3, value: (s) => s.gratidao },
  { id: 'coragem', title: 'Coragem treinada', desc: 'Primeira conversa difícil treinada', icon: Sword, goal: 1, value: (s) => s.conversa + s.arena },
  { id: 'chao', title: 'Pés no chão', desc: 'Fez o aterramento 5-4-3-2-1', icon: Footprints, goal: 1, value: (s) => s.aterramento },
  { id: 'rede', title: 'Rede de apoio', desc: 'Criou o plano de segurança', icon: ShieldCheck, goal: 1, value: (s) => s.plan },
  { id: 'noite', title: 'Noite mais leve', desc: 'Usou o Modo noite', icon: Moon, goal: 1, value: (s) => s.noite },
  { id: 'perolas-14', title: 'Colecionador de pérolas', desc: '14 dias com hábitos nos Logs', icon: Gem, goal: 14, value: (s) => s.habitDays },
  { id: 'porto-10', title: 'Porto conhecido', desc: '10 conversas com a Nórica', icon: MessageCircleHeart, goal: 10, value: (s) => s.chats },
  { id: 'seq-30', title: 'Um mês de mar calmo', desc: '30 dias seguidos cuidando de você', icon: Sun, goal: 30, value: (s) => s.bestStreak },
  { id: 'mar-30', title: 'Navegante', desc: 'Humor registrado em 30 dias', icon: Trophy, goal: 30, value: (s) => s.moodDays },
];

export default function Conquistas() {
  const uid = getAuthState().user?.id;
  const [stats, setStats] = useState<AchievementStats | null>(() => cacheGet<AchievementStats>(uid, 'achievements'));
  const [fresh, setFresh] = useState<Badge[]>([]);
  const [selected, setSelected] = useState<Badge | null>(null);

  useEffect(() => {
    noricaApi.achievements().then(({ stats: s }) => {
      setStats(s);
      cacheSet(uid, 'achievements', s);
      // Comemora o que foi conquistado desde a última visita.
      const before = new Set(cacheGet<string[]>(uid, 'achievementsSeen') ?? []);
      const unlocked = BADGES.filter((b) => b.value(s) >= b.goal);
      const newOnes = unlocked.filter((b) => !before.has(b.id));
      cacheSet(uid, 'achievementsSeen', unlocked.map((b) => b.id));
      if (newOnes.length && before.size + newOnes.length > 0 && cacheGet<boolean>(uid, 'achievementsInit')) {
        setFresh(newOnes);
        try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#34d399', '#38bdf8', '#f472b6', '#fbbf24'] }); } catch (_e) {}
        setTimeout(() => setFresh([]), 6000);
      }
      cacheSet(uid, 'achievementsInit', true);
    }).catch(() => {});
  }, []);

  const unlockedCount = stats ? BADGES.filter((b) => b.value(stats) >= b.goal).length : 0;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-[3rem] p-8 text-white shadow-2xl border border-white/10 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-amber-300" />
          <h3 className="text-sm font-black text-amber-300 uppercase tracking-widest">Conquistas</h3>
        </div>
        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{unlockedCount}/{BADGES.length}</span>
      </div>

      <AnimatePresence>
        {fresh.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-2xl bg-amber-400/10 border border-amber-300/30">
            <p className="text-sm font-black text-amber-200">Nova conquista: {fresh.map((b) => b.title).join(', ')} ✨</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!stats ? (
        <div className="grid grid-cols-3 gap-3" aria-label="Carregando conquistas">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[104px] rounded-2xl" />)}
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-3">
        {BADGES.map((b, i) => {
          const v = stats ? b.value(stats) : 0;
          const done = v >= b.goal;
          return (
            <button
              key={b.id}
              onClick={() => setSelected(selected?.id === b.id ? null : b)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-colors ${done ? 'bg-amber-400/10 border-amber-300/30 badge-glow' : 'bg-black/20 border-white/5'}`}
              style={done ? ({ '--glow-delay': `${(i % 5) * 0.9}s` } as React.CSSProperties) : undefined}
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${done ? 'bg-amber-400/20 text-amber-200' : 'bg-white/5 text-white/25'}`}>
                {done ? <b.icon size={20} /> : <Lock size={16} />}
              </div>
              <span className={`text-[10px] font-black leading-tight ${done ? 'text-white' : 'text-white/40'}`}>{b.title}</span>
              {!done && b.goal > 1 && (
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-300/60 rounded-full" style={{ width: `${Math.min(100, (100 * v) / b.goal)}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      )}

      {selected && stats && (
        <p className="text-xs text-white/70 font-semibold leading-relaxed">
          <b className="text-white">{selected.title}:</b> {selected.desc}.{' '}
          {selected.value(stats) >= selected.goal ? 'Conquistada! 💛' : `Progresso: ${Math.min(selected.value(stats), selected.goal)}/${selected.goal}.`}
        </p>
      )}
    </div>
  );
}
