"use client";

// Painel de sons (mar, chuva, ruído branco/marrom) com volume e timer.
// Usado na Respiração e no Modo noite. O som continua ao trocar de tela.

import React, { useEffect, useState } from 'react';
import { Waves, CloudRain, Radio, Moon, Square, Timer } from 'lucide-react';
import { SOUNDS, playSound, stopSound, setVolume, setTimer, useAmbient, type SoundId } from '@/lib/ambient';

const ICONS: Record<SoundId, any> = { mar: Waves, chuva: CloudRain, branco: Radio, marrom: Moon };
const TIMERS = [0, 15, 30, 60];

export default function SonsAmbiente({ compact = false, defaultTimer = 0 }: { compact?: boolean; defaultTimer?: number }) {
  const { playing, volume, endsAt } = useAmbient();
  const [minutes, setMinutes] = useState(defaultTimer);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [endsAt]);

  const left = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 60_000)) : 0;

  return (
    <div className={`bg-white/5 border border-white/10 backdrop-blur-md rounded-[2rem] ${compact ? 'p-4' : 'p-6'} space-y-4 text-white`} data-testid="sons">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-400/80">Sons para acalmar</span>
        {playing && (
          <button onClick={() => stopSound()} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60">
            <Square size={10} /> Parar
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SOUNDS.map((s) => {
          const Icon = ICONS[s.id];
          const on = playing === s.id;
          return (
            <button
              key={s.id}
              aria-pressed={on}
              onClick={() => (on ? stopSound() : playSound(s.id, minutes))}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors ${on ? 'bg-teal-500/20 border-teal-400/40 text-teal-200' : 'bg-black/20 border-white/5 text-white/60'}`}
            >
              <Icon size={18} className={on ? 'animate-pulse' : ''} />
              <span className="text-[9px] font-black leading-tight text-center px-1">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[9px] font-black uppercase tracking-widest text-white/40 w-12">Volume</span>
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-teal-400"
          aria-label="Volume"
        />
      </div>

      <div className="flex items-center gap-2">
        <Timer size={12} className="text-white/40" />
        {TIMERS.map((m) => (
          <button
            key={m}
            onClick={() => { setMinutes(m); if (playing) setTimer(m); }}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${minutes === m ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/40'}`}
          >
            {m === 0 ? 'Sem fim' : `${m} min`}
          </button>
        ))}
      </div>
      {playing && endsAt && <p className="text-[10px] font-bold text-white/40">Desliga sozinho em ~{left} min, abaixando devagar.</p>}
    </div>
  );
}
