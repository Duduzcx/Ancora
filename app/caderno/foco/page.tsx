"use client";

// Sessão de foco: escolhe o tempo, marca como está a ansiedade, estuda com o som do mar
// e, no fim, marca de novo. Se a ansiedade estiver alta, a Nórica sugere respirar antes.

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Timer, Play, Pause, Square, Waves, CloudRain, VolumeX, Wind, Coffee } from 'lucide-react';
import { noricaApi, type StudySummary } from '@/lib/norica-api';
import { playSound, setVolume, stopSound, type SoundId } from '@/lib/ambient';
import { rememberStudy } from '@/lib/caderno';

const LEVELS = [
  { n: 1, e: '😌', l: 'Tranquilo' },
  { n: 2, e: '🙂', l: 'Bem' },
  { n: 3, e: '😐', l: 'Mais ou menos' },
  { n: 4, e: '😟', l: 'Ansioso' },
  { n: 5, e: '😣', l: 'Muito ansioso' },
];
const SOUNDS: { id: SoundId | null; label: string; icon: any }[] = [
  { id: 'mar', label: 'Mar', icon: Waves },
  { id: 'chuva', label: 'Chuva', icon: CloudRain },
  { id: 'cafe', label: 'Café', icon: Coffee },
  { id: null, label: 'Silêncio', icon: VolumeX },
];

type Step = 'antes' | 'foco' | 'depois' | 'fim' | 'pausa';

export default function FocoPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('antes');
  const [minutes, setMinutes] = useState(25);
  const [sound, setSound] = useState<SoundId | null>('mar');
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ minutes: number; summary: StudySummary | null } | null>(null);
  const endAt = useRef(0);
  const total = useRef(0);
  const elapsed = useRef(0);

  useEffect(() => () => stopSound(1), []);

  // Relógio pela hora real: não atrasa se o celular ficar lento.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) {
        setRunning(false);
        try { navigator.vibrate?.([200, 120, 200]); } catch (_e) {}
        if (step === 'foco') { elapsed.current = total.current; stopSound(3); setStep('depois'); }
        else { stopSound(2); setStep('antes'); }
      }
    }, 250);
    return () => clearInterval(t);
  }, [running, step]);

  const start = () => {
    total.current = minutes * 60;
    setTotalSec(total.current);
    endAt.current = Date.now() + total.current * 1000;
    setLeft(total.current);
    setRunning(true);
    setStep('foco');
    if (sound) { setVolume(0.3); playSound(sound).catch(() => {}); }
  };
  const togglePause = () => {
    if (running) { setRunning(false); setVolume(0.08); }
    else { endAt.current = Date.now() + left * 1000; setRunning(true); setVolume(0.3); }
  };
  const finishEarly = () => {
    setRunning(false);
    elapsed.current = total.current - left;
    stopSound(2);
    setStep('depois');
  };
  const save = async (a: number | null) => {
    setAfter(a);
    const mins = Math.max(1, Math.round(elapsed.current / 60));
    setResult({ minutes: mins, summary: null });
    setStep('fim');
    try { const r = await noricaApi.studySessionSave(mins, before, a); rememberStudy(r.summary); setResult({ minutes: mins, summary: r.summary }); } catch (_e) {}
  };
  const endBreak = () => { setRunning(false); stopSound(1.5); setStep('antes'); };
  const breakTime = () => {
    total.current = 5 * 60;
    setTotalSec(total.current);
    endAt.current = Date.now() + total.current * 1000;
    setLeft(total.current);
    setRunning(true);
    setStep('pausa');
    setVolume(0.25); playSound('mar').catch(() => {});
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const pct = totalSec ? 1 - left / totalSec : 0;
  const ring = step === 'pausa' ? '#5eead4' : '#fbbf24';

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="foco">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => (step === 'foco' ? finishEarly() : step === 'pausa' ? endBreak() : router.replace('/caderno/'))} className="p-3 bg-white/5 border border-white/10 rounded-full text-amber-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-amber-300/80 uppercase tracking-[0.25em]"><Timer size={12} /> Foco</span>
        </div>

        {step === 'antes' && (
          <section className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tighter leading-none">Um tempo de <span className="text-amber-300 italic">foco tranquilo.</span></h1>
              <p className="text-sm text-white/55 font-semibold leading-relaxed">Deixe o celular de lado, escolha um som e estude por um tempo curto. No fim, uma pausa.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Quanto tempo</p>
              <div className="grid grid-cols-3 gap-2">
                {[15, 25, 45].map((m) => (
                  <button key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className={`py-3 rounded-2xl border text-[13px] font-black ${minutes === m ? 'bg-amber-400/15 border-amber-300/40 text-amber-100' : 'bg-white/[0.04] border-white/10 text-white/55'}`}>{m} min</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Som de fundo</p>
              <div className="grid grid-cols-4 gap-2">
                {SOUNDS.map((s) => (
                  <button key={s.label} onClick={() => setSound(s.id)} aria-pressed={sound === s.id} className={`py-3 rounded-2xl border text-[11px] font-black flex flex-col items-center gap-1 ${sound === s.id ? 'bg-amber-400/15 border-amber-300/40 text-amber-100' : 'bg-white/[0.04] border-white/10 text-white/55'}`}>
                    <s.icon size={16} /> {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Como está sua ansiedade agora?</p>
              <div className="grid grid-cols-5 gap-1.5">
                {LEVELS.map((l) => (
                  <button key={l.n} onClick={() => setBefore(l.n)} aria-pressed={before === l.n} className={`py-2.5 rounded-2xl border flex flex-col items-center gap-0.5 ${before === l.n ? 'bg-white/15 border-white/30' : 'bg-white/[0.04] border-white/10'}`} data-testid={`antes-${l.n}`}>
                    <span className="text-2xl">{l.e}</span><span className="text-[8px] font-black text-white/55 uppercase leading-tight text-center">{l.l}</span>
                  </button>
                ))}
              </div>
            </div>
            {before !== null && before >= 4 && (
              <button onClick={() => router.push('/respiracao/')} className="w-full p-4 rounded-2xl bg-teal-400/10 border border-teal-300/25 text-left flex items-center gap-3 card-in" data-testid="sugere-respirar">
                <Wind size={20} className="text-teal-300 shrink-0" />
                <span className="text-[12px] font-bold text-white/80 leading-snug">A cabeça acelerada atrapalha a memória. Que tal 1 minuto de respiração antes de começar?</span>
              </button>
            )}
            <button onClick={start} className="w-full py-4 rounded-2xl bg-amber-300 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2" data-testid="foco-comecar">
              <Play size={14} fill="currentColor" /> Começar {minutes} minutos
            </button>
          </section>
        )}

        {(step === 'foco' || step === 'pausa') && (
          <section className="pt-6 space-y-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: ring }}>{step === 'pausa' ? 'Pausa — levante, beba água' : running ? 'Foco' : 'Pausado'}</p>
            <div className="relative w-64 h-64 mx-auto rounded-full flex items-center justify-center" style={{ background: `conic-gradient(${ring} ${pct * 360}deg, rgba(255,255,255,0.08) 0deg)` }}>
              <div className="absolute inset-3 rounded-full bg-[#031a1f]" />
              <span className="relative text-6xl font-black tracking-tighter tabular-nums" data-testid="relogio">{mm}:{ss}</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={step === 'pausa' ? endBreak : finishEarly} className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60" aria-label="Encerrar"><Square size={18} /></button>
              <button onClick={togglePause} className="w-20 h-20 rounded-full text-slate-950 flex items-center justify-center" style={{ background: ring }} aria-label={running ? 'Pausar' : 'Continuar'}>
                {running ? <Pause size={28} /> : <Play size={28} fill="currentColor" />}
              </button>
              <span className="w-14" />
            </div>
            {step === 'foco' && <p className="text-[12px] text-white/40 font-semibold">Uma coisa de cada vez. Se a cabeça fugir, só volte. 🌊</p>}
          </section>
        )}

        {step === 'depois' && (
          <section className="pt-6 space-y-5 text-center card-in">
            <p className="text-5xl">⏱️</p>
            <h1 className="text-3xl font-black tracking-tighter">Tempo de foco feito!</h1>
            <p className="text-sm text-white/55 font-semibold">E agora, como está sua ansiedade?</p>
            <div className="grid grid-cols-5 gap-1.5">
              {LEVELS.map((l) => (
                <button key={l.n} onClick={() => save(l.n)} className="py-2.5 rounded-2xl border bg-white/[0.04] border-white/10 flex flex-col items-center gap-0.5" data-testid={`depois-${l.n}`}>
                  <span className="text-2xl">{l.e}</span><span className="text-[8px] font-black text-white/55 uppercase leading-tight">{l.l}</span>
                </button>
              ))}
            </div>
            <button onClick={() => save(null)} className="text-[10px] font-black uppercase tracking-widest text-white/40 underline underline-offset-4">Pular</button>
          </section>
        )}

        {step === 'fim' && result && (
          <section className="pt-6 space-y-4 text-center card-in" data-testid="foco-fim">
            <p className="text-5xl">🌟</p>
            <h1 className="text-3xl font-black tracking-tighter">{result.minutes} {result.minutes === 1 ? 'minuto' : 'minutos'} de foco.</h1>
            <p className="text-sm text-white/60 font-semibold leading-relaxed">
              {before && after ? (after < before ? `Sua ansiedade baixou de ${before} para ${after}. Estudar com calma ajuda. 💚` : after > before ? 'A ansiedade subiu um pouco. Tudo bem — uma pausa e uma respiração ajudam a voltar.' : 'Você manteve o ritmo. Pequeno e constante é o que faz diferença.') : 'Pequeno e constante é o que faz diferença.'}
              {result.summary?.weekMinutes ? ` Nesta semana: ${result.summary.weekMinutes} min de foco.` : ''}
            </p>
            {after !== null && after >= 4 && (
              <button onClick={() => router.push('/respiracao/')} className="w-full p-4 rounded-2xl bg-teal-400/10 border border-teal-300/25 text-[12px] font-bold text-white/80">Respirar 1 minuto antes de continuar</button>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={breakTime} className="py-3.5 rounded-2xl bg-teal-300 text-slate-950 text-[10px] font-black uppercase tracking-widest">Pausa de 5 min</button>
              <button onClick={() => router.push('/caderno/')} className="py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Anotar o que aprendi</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
