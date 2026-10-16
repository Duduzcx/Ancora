"use client";

// Modo "não quero falar": acalmar só com toques, sem precisar escrever.
// Segure o círculo enquanto puxa o ar, solte enquanto solta o ar. Ou estoure bolhas devagar.

import React, { useEffect, useRef, useState } from 'react';
import { X, Wind, CircleDot } from 'lucide-react';

async function buzz(ms = 20) {
  try { const { Haptics, ImpactStyle } = await import('@capacitor/haptics'); await Haptics.impact({ style: ms > 30 ? ImpactStyle.Medium : ImpactStyle.Light }); } catch (_e) { try { navigator.vibrate?.(ms); } catch (_e2) {} }
}

function Respirar() {
  const [holding, setHolding] = useState(false);
  const [cycles, setCycles] = useState(0);
  const startRef = useRef(0);
  const down = () => { setHolding(true); startRef.current = Date.now(); buzz(); };
  const up = () => {
    if (!holding) return;
    setHolding(false);
    if (Date.now() - startRef.current > 1500) { setCycles((c) => c + 1); buzz(40); }
  };
  return (
    <div className="flex flex-col items-center gap-8 select-none">
      <p className="text-white/60 text-sm font-semibold text-center min-h-[2.5rem]">
        {holding ? 'Puxe o ar devagar…' : cycles === 0 ? 'Segure o círculo enquanto puxa o ar.\nSolte enquanto solta o ar.' : 'Solte o ar devagar… e segure de novo.'}
      </p>
      <button
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Segure para puxar o ar"
        className="relative w-56 h-56 rounded-full touch-none"
        data-testid="toque-circulo"
      >
        <span className="absolute inset-0 rounded-full bg-teal-400/20 blur-2xl" style={{ transform: `scale(${holding ? 1.35 : 0.9})`, transition: `transform ${holding ? 4 : 6}s ease-in-out` }} />
        <span className="absolute inset-6 rounded-full border border-teal-200/30 bg-teal-500/10 flex items-center justify-center" style={{ transform: `scale(${holding ? 1.2 : 0.85})`, transition: `transform ${holding ? 4 : 6}s ease-in-out` }}>
          <Wind size={36} className="text-teal-100/70" />
        </span>
      </button>
      <div className="flex gap-1.5" aria-label={`${cycles} respirações`}>
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < cycles ? 'bg-teal-300' : 'bg-white/15'}`} />)}
      </div>
      {cycles >= 6 && <p className="text-teal-100 font-bold text-center">Muito bem. Seu corpo já está mais calmo do que há um minuto. 💚</p>}
    </div>
  );
}

type Bubble = { id: number; x: number; size: number; dur: number };
function Bolhas() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [popped, setPopped] = useState(0);
  const idRef = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      setBubbles((b) => [...b.slice(-14), { id: ++idRef.current, x: 8 + Math.random() * 78, size: 44 + Math.random() * 36, dur: 7 + Math.random() * 5 }]);
    }, 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative w-full h-[60dvh] overflow-hidden">
      <p className="absolute top-0 inset-x-0 text-center text-white/60 text-sm font-semibold z-10">Estoure as bolhas devagar. {popped > 0 && <b className="text-teal-200">{popped}</b>}</p>
      {bubbles.map((b) => (
        <button
          key={b.id}
          aria-label="Bolha"
          onClick={() => { setBubbles((all) => all.filter((x) => x.id !== b.id)); setPopped((p) => p + 1); buzz(); }}
          className="absolute bottom-[-90px] rounded-full border border-white/30 bg-white/10 bubble-up"
          style={{ left: `${b.x}%`, width: b.size, height: b.size, animationDuration: `${b.dur}s` }}
        />
      ))}
    </div>
  );
}

export default function ToqueGuia({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<'respirar' | 'bolhas'>('respirar');
  return (
    <div className="fixed inset-0 z-[3000] bg-[#04141a] flex flex-col" data-testid="toque">
      <div className="flex items-center justify-between p-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex gap-2">
          <button onClick={() => setMode('respirar')} className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${mode === 'respirar' ? 'bg-teal-400/20 text-teal-100' : 'text-white/40'}`}><Wind size={12} /> Respirar</button>
          <button onClick={() => setMode('bolhas')} className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${mode === 'bolhas' ? 'bg-teal-400/20 text-teal-100' : 'text-white/40'}`}><CircleDot size={12} /> Bolhas</button>
        </div>
        {onClose && <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white" aria-label="Fechar"><X size={18} /></button>}
      </div>
      <div className="flex-1 flex items-center justify-center px-6 whitespace-pre-line">
        {mode === 'respirar' ? <Respirar /> : <Bolhas />}
      </div>
      <p className="text-center text-[11px] text-white/35 font-semibold pb-[calc(env(safe-area-inset-bottom)+1.5rem)] px-6">Sem palavras, sem pressa. Se precisar de alguém agora: CVV 188.</p>
    </div>
  );
}
