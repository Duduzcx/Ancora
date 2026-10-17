"use client";

// Meditações guiadas: a voz natural da Nórica (gerada uma vez e guardada no servidor) lê
// cada trecho, com silêncio entre eles e um som do mar/chuva baixinho por baixo.
// Sem internet ou sem voz natural, a voz do próprio celular lê o mesmo texto.

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, Square, Headphones, Loader2, Check } from 'lucide-react';
import { MEDITACOES, type Meditacao } from '@/supabase/functions/_shared/meditacoes';
import { noricaApi } from '@/lib/norica-api';
import { getVoicePrefs, speak, stopSpeaking } from '@/lib/speech';
import { playSound, setVolume, stopSound } from '@/lib/ambient';

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'done';

export default function MeditacoesPage() {
  const router = useRouter();
  const [med, setMed] = useState<Meditacao | null>(null);
  const [state, setState] = useState<State>('idle');
  const [part, setPart] = useState(0);
  const [withSound, setWithSound] = useState(true);
  const run = useRef(0);
  const paused = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stopAll = () => {
    run.current++;
    paused.current = false;
    try { audio.current?.pause(); } catch (_e) {}
    audio.current = null;
    stopSpeaking().catch(() => {});
    stopSound(2);
  };
  useEffect(() => () => stopAll(), []);

  // Espera "s" segundos, respeitando pausa e parada.
  const wait = async (s: number, token: number) => {
    let left = s * 1000;
    while (left > 0) {
      if (token !== run.current) return false;
      await new Promise((r) => setTimeout(r, 200));
      if (!paused.current) left -= 200;
    }
    return token === run.current;
  };

  const playUrl = (url: string, token: number) => new Promise<void>((resolve, reject) => {
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('audio'));
    a.play().catch(reject);
    const check = setInterval(() => {
      if (token !== run.current) { clearInterval(check); a.pause(); resolve(); }
      else if (paused.current && !a.paused) a.pause();
      else if (!paused.current && a.paused && !a.ended) a.play().catch(() => {});
      if (a.ended) clearInterval(check);
    }, 200);
  });

  const start = async (m: Meditacao) => {
    stopAll();
    const token = ++run.current;
    setMed(m); setPart(0); setState('loading');
    const prefs = getVoicePrefs();
    let natural = prefs.engine === 'natural' && (typeof navigator === 'undefined' || navigator.onLine !== false);
    if (withSound) { setVolume(0.35); playSound(m.sound).catch(() => {}); }
    const fetchPart = (i: number) => (natural ? noricaApi.meditationAudio(m.id, i, prefs.natural).then((r) => r.url) : Promise.resolve(null));
    let next: Promise<string | null> = fetchPart(0).catch(() => null);
    for (let i = 0; i < m.parts.length; i++) {
      if (token !== run.current) return;
      setPart(i);
      const url = await next;
      next = i + 1 < m.parts.length ? fetchPart(i + 1).catch(() => null) : Promise.resolve(null); // já prepara o próximo trecho
      if (token !== run.current) return;
      setState(paused.current ? 'paused' : 'playing');
      let ok = false;
      if (url) { try { await playUrl(url, token); ok = true; } catch (_e) { natural = false; } }
      if (!ok) await speak(`med-${m.id}-${i}`, m.parts[i].t, { engine: 'device', rate: 0.9 });
      if (!(await wait(m.parts[i].p, token))) return;
    }
    if (token === run.current) { setState('done'); stopSound(6); }
  };

  const togglePause = () => {
    paused.current = !paused.current;
    setState(paused.current ? 'paused' : 'playing');
    if (paused.current) { stopSpeaking().catch(() => {}); setVolume(0.12); } else setVolume(0.35);
  };
  const close = () => { stopAll(); setMed(null); setState('idle'); };

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="meditacoes">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => (med ? close() : router.back())} className="p-3 bg-white/5 border border-white/10 rounded-full text-teal-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-teal-300/80 uppercase tracking-[0.25em]">Meditações guiadas</span>
        </div>

        {!med ? (
          <>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tighter leading-none">Alguns minutos <span className="text-teal-300 italic">só para você.</span></h1>
              <p className="text-sm text-white/55 font-semibold leading-relaxed">Coloque o fone, se puder. A voz da Nórica guia, e o som do mar fica baixinho por trás.</p>
            </div>
            <label className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-[12px] font-bold text-white/70">
              <span className="flex items-center gap-2"><Headphones size={15} className="text-teal-300" /> Som de fundo</span>
              <button role="switch" aria-checked={withSound} onClick={() => setWithSound((v) => !v)} className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${withSound ? 'bg-teal-400' : 'bg-white/10'}`}>
                <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white transition-transform ${withSound ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </label>
            <div className="space-y-3">
              {MEDITACOES.map((m) => (
                <button key={m.id} onClick={() => start(m)} className="w-full text-left p-5 rounded-[2rem] bg-white/5 border border-white/10 flex items-center gap-4 active:scale-[0.98] transition-transform" data-testid={`meditacao-${m.id}`}>
                  <span className="w-14 h-14 rounded-2xl bg-teal-400/10 border border-teal-300/20 flex items-center justify-center text-2xl shrink-0">{m.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-black tracking-tight">{m.title}</span>
                    <span className="block text-[12px] text-white/55 font-semibold leading-snug mt-0.5">{m.desc}</span>
                    <span className="block text-[9px] font-black text-teal-300 uppercase tracking-widest mt-1.5">{m.minutes} min</span>
                  </span>
                  <Play size={18} className="text-white/40 shrink-0" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <section className="pt-6 space-y-8 text-center" data-testid="player">
            <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
              <span className={`absolute inset-0 rounded-full bg-teal-400/10 ${state === 'playing' ? 'breathe-scale' : ''}`} />
              <span className="absolute inset-6 rounded-full border border-teal-300/25" />
              <span className="relative text-6xl">{med.emoji}</span>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-teal-300/80 uppercase tracking-[0.3em]">{med.title}</p>
              <p className="min-h-[5.5rem] text-lg font-bold leading-snug text-white/85 px-2" aria-live="polite" data-testid="legenda">
                {state === 'loading' ? 'Preparando a voz…' : state === 'done' ? 'Que bom que você se deu esse tempo. 💚' : med.parts[part].t}
              </p>
            </div>
            <div className="flex gap-1 justify-center" aria-hidden="true">
              {med.parts.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all ${i < part || state === 'done' ? 'w-4 bg-teal-300' : i === part ? 'w-6 bg-teal-300/70' : 'w-2 bg-white/15'}`} />)}
            </div>
            {state === 'done' ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={close} className="py-4 rounded-2xl bg-teal-400 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Check size={14} /> Concluir</button>
                <button onClick={() => router.push('/hoje/')} className="py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Registrar o dia</button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <button onClick={close} className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60" aria-label="Parar"><Square size={18} /></button>
                <button onClick={togglePause} disabled={state === 'loading'} className="w-20 h-20 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center shadow-[0_0_40px_rgba(45,212,191,0.35)]" aria-label={state === 'paused' ? 'Continuar' : 'Pausar'} data-testid="pausar">
                  {state === 'loading' ? <Loader2 size={26} className="animate-spin" /> : state === 'paused' ? <Play size={28} /> : <Pause size={28} />}
                </button>
                <span className="w-14" />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
