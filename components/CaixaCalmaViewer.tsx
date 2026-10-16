"use client";

// Abre a caixa de calma em tela cheia, um item por vez (usado no S.O.S e na própria página).

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, Music } from 'lucide-react';
import type { CalmItem } from '@/lib/calma';

export default function CaixaCalmaViewer({ items, onClose }: { items: CalmItem[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const item = items[i];
  const url = useMemo(() => (item?.blob ? URL.createObjectURL(item.blob) : null), [item]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  useEffect(() => { audio?.pause(); setPlaying(false); setAudio(null); }, [i]);
  if (!item) return null;

  const play = () => {
    if (!url) return;
    if (audio && playing) { audio.pause(); setPlaying(false); return; }
    const a = audio ?? new Audio(url);
    a.onended = () => setPlaying(false);
    a.play().then(() => setPlaying(true)).catch(() => {});
    setAudio(a);
  };
  const openMusic = async () => {
    if (!item.url) return;
    try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url: item.url }); } catch (_e) { window.open(item.url, '_blank'); }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-[#06121a] flex flex-col" data-testid="caixa-viewer">
      <div className="flex items-center justify-between p-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200/80">Sua caixa de calma · {i + 1}/{items.length}</span>
        <button onClick={() => { audio?.pause(); onClose(); }} className="p-2 rounded-full bg-white/10 text-white" aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-md text-center space-y-5">
            {item.kind === 'foto' && url && <img src={url} alt={item.text || 'Foto da sua caixa de calma'} className="w-full max-h-[55dvh] object-contain rounded-[2rem]" />}
            {item.kind === 'frase' && <p className="text-3xl font-black text-white leading-snug tracking-tight">“{item.text}”</p>}
            {item.kind === 'audio' && (
              <button onClick={play} className="mx-auto w-28 h-28 rounded-full bg-amber-300 text-slate-950 flex items-center justify-center" aria-label={playing ? 'Pausar' : 'Ouvir'}>
                {playing ? <Pause size={40} /> : <Play size={40} className="ml-1" />}
              </button>
            )}
            {item.kind === 'musica' && (
              <button onClick={openMusic} className="mx-auto px-6 py-5 rounded-[2rem] bg-white/10 border border-white/15 text-white font-black flex items-center gap-3"><Music size={22} /> Tocar música</button>
            )}
            {item.kind !== 'frase' && item.text && <p className="text-lg font-bold text-white/80">{item.text}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <button onClick={() => setI((i - 1 + items.length) % items.length)} className="p-4 rounded-full bg-white/10 text-white" aria-label="Anterior"><ChevronLeft size={22} /></button>
        <p className="text-xs text-white/40 font-semibold">Respire devagar. Você já passou por dias difíceis antes.</p>
        <button onClick={() => setI((i + 1) % items.length)} className="p-4 rounded-full bg-white/10 text-white" aria-label="Próximo"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
}
