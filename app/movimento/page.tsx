"use client";

// Pausa de movimento: 2 minutos de alongamento guiado (pescoço, ombros, costas, mãos e pernas).
// Bom para quem estuda ou trabalha sentado. Nada de dor: só até onde é confortável.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, Play, Pause, SkipForward, PersonStanding } from 'lucide-react';

const STEPS = [
  { title: 'Pescoço', text: 'Incline a cabeça devagar para a direita, respire, e depois para a esquerda.', secs: 25, anim: 'mv-tilt' },
  { title: 'Ombros', text: 'Gire os ombros para trás em círculos lentos. Depois para frente.', secs: 20, anim: 'mv-roll' },
  { title: 'Espreguiçar', text: 'Entrelace os dedos e estique os braços para cima, crescendo a coluna.', secs: 20, anim: 'mv-stretch' },
  { title: 'Costas', text: 'Sentado, gire o tronco para um lado segurando no encosto. Respire. Troque de lado.', secs: 25, anim: 'mv-twist' },
  { title: 'Mãos e punhos', text: 'Abra e feche as mãos. Gire os punhos devagar nos dois sentidos.', secs: 15, anim: 'mv-roll' },
  { title: 'Pernas', text: 'Fique de pé, apoie-se se precisar e eleve os calcanhares devagar, 10 vezes.', secs: 20, anim: 'mv-rise' },
];

async function tap() {
  try { const { Haptics, ImpactStyle } = await import('@capacitor/haptics'); await Haptics.impact({ style: ImpactStyle.Light }); } catch (_e) {}
}

export default function MovimentoPage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(STEPS[0].secs);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Acabou o tempo do passo: vibra e vai para o próximo (ou termina).
  useEffect(() => {
    if (!running || left > 0) return;
    tap();
    if (i + 1 >= STEPS.length) {
      setRunning(false);
      setDone(true);
      try { confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } }); } catch (_e) {}
    } else {
      setI(i + 1);
      setLeft(STEPS[i + 1].secs);
    }
  }, [left, running, i]);

  const step = STEPS[i];
  const skip = () => { if (i + 1 < STEPS.length) { setI(i + 1); setLeft(STEPS[i + 1].secs); } else { setRunning(false); setDone(true); } };
  const restart = () => { setI(0); setLeft(STEPS[0].secs); setDone(false); setRunning(true); };

  return (
    <main className="min-h-[100dvh] bg-[#06120e] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="movimento">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.12)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-emerald-200/80 uppercase tracking-[0.25em]">Pausa de movimento · 2 min</span>
        </div>
        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Seu corpo <span className="text-emerald-300 italic">também pede pausa.</span></h1>
          <p className="text-sm text-white/55 font-semibold">Só até onde for confortável. Se doer, pare.</p>
        </div>

        {done ? (
          <section className="p-8 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-400/25 text-center space-y-4">
            <p className="text-2xl font-black">Pronto! 🌿</p>
            <p className="text-sm text-white/70 font-semibold">2 minutos para você. Que tal marcar "Fiz um alongamento" nos Logs?</p>
            <div className="flex gap-2">
              <button onClick={() => router.push('/log/')} className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest">Ir para os Logs</button>
              <button onClick={restart} className="px-5 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest">De novo</button>
            </div>
          </section>
        ) : (
          <section className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-6 text-center">
            <p className="text-[10px] font-black text-emerald-300/80 uppercase tracking-widest">{i + 1} de {STEPS.length}</p>
            <div className="mx-auto w-36 h-36 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
              <PersonStanding size={72} className={`text-emerald-200 ${running ? step.anim : ''}`} />
            </div>
            <div>
              <h2 className="text-2xl font-black">{step.title}</h2>
              <p className="text-sm text-white/70 font-semibold leading-relaxed mt-2">{step.text}</p>
            </div>
            <p className="text-5xl font-black tabular-nums">{left}s</p>
            <div className="flex gap-2">
              <button onClick={() => setRunning(!running)} className="flex-1 py-4 rounded-2xl bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                {running ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> {i === 0 && left === STEPS[0].secs ? 'Começar' : 'Continuar'}</>}
              </button>
              <button onClick={skip} aria-label="Pular" className="px-5 rounded-2xl bg-white/10 border border-white/15"><SkipForward size={16} /></button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
