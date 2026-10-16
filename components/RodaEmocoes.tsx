"use client";

// Roda das emoções: depois de escolher o "mar" (calmo, ansioso, agitado), a pessoa pode dar
// um nome mais exato ao que sente. Dar nome ao sentimento já ajuda a acalmar — e a Nórica
// passa a conversar usando a palavra da própria pessoa.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircleHeart, Check } from 'lucide-react';
import type { Mood } from '@/lib/norica-api';

export const FEELINGS: Record<Exclude<Mood, 'sos'>, { label: string; color: string; words: string[] }> = {
  calmo: { label: 'Calmo', color: '#10b981', words: ['tranquilo', 'grato', 'aliviado', 'animado', 'orgulhoso', 'descansado', 'esperançoso', 'em paz'] },
  ansioso: { label: 'Ansioso', color: '#f59e0b', words: ['preocupado', 'inseguro', 'sobrecarregado', 'inquieto', 'com medo', 'tenso', 'confuso', 'pressionado'] },
  agitado: { label: 'Agitado', color: '#f43f5e', words: ['irritado', 'frustrado', 'triste', 'magoado', 'exausto', 'sozinho', 'com raiva', 'decepcionado'] },
};

type Props = {
  mood: Exclude<Mood, 'sos'> | null;
  onClose: () => void;
  onDone: (mood: Exclude<Mood, 'sos'>, feeling: string | null, talk: boolean) => void;
};

export default function RodaEmocoes({ mood, onClose, onDone }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const info = mood ? FEELINGS[mood] : null;
  return (
    <AnimatePresence>
      {mood && info && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] max-w-lg mx-auto"
            data-testid="roda-emocoes"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: info.color }}>{info.label}</p>
            <h3 className="text-2xl font-black text-white tracking-tight leading-tight mt-1">Qual palavra chega mais perto?</h3>
            <p className="text-xs text-white/50 font-semibold mt-1">Dar nome ao que você sente já ajuda. Se nenhuma servir, tudo bem pular.</p>
            <div className="flex flex-wrap gap-2 mt-5">
              {info.words.map((w) => (
                <button
                  key={w}
                  onClick={() => setPicked(picked === w ? null : w)}
                  aria-pressed={picked === w}
                  className={`px-4 py-2.5 rounded-full border text-sm font-bold transition-colors ${picked === w ? 'text-slate-950' : 'bg-white/5 border-white/10 text-white/75'}`}
                  style={picked === w ? { background: info.color, borderColor: info.color } : undefined}
                >
                  {picked === w && <Check size={12} className="inline mr-1 -mt-0.5" />}{w}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <button onClick={() => { onDone(mood, picked, true); setPicked(null); }} className="py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                <MessageCircleHeart size={14} /> Conversar
              </button>
              <button onClick={() => { onDone(mood, picked, false); setPicked(null); }} className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-black uppercase tracking-widest text-[10px]">
                Só registrar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
