"use client";

// Trilhas de 7 dias: escolha um objetivo e faça um passo curto por dia.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { TRACKS, completeToday, getTracks, leaveTrack, startTrack, todayStep, trackById, type TracksState } from '@/lib/trilhas';

const TONE: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  amber: { text: 'text-amber-300', bg: 'bg-amber-400/10', border: 'border-amber-300/25', bar: 'bg-amber-300' },
  indigo: { text: 'text-indigo-300', bg: 'bg-indigo-400/10', border: 'border-indigo-300/25', bar: 'bg-indigo-300' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-400/10', border: 'border-emerald-300/25', bar: 'bg-emerald-300' },
  sky: { text: 'text-sky-300', bg: 'bg-sky-400/10', border: 'border-sky-300/25', bar: 'bg-sky-300' },
  rose: { text: 'text-rose-300', bg: 'bg-rose-400/10', border: 'border-rose-300/25', bar: 'bg-rose-300' },
  violet: { text: 'text-violet-300', bg: 'bg-violet-400/10', border: 'border-violet-300/25', bar: 'bg-violet-300' },
};

export default function TrilhasPage() {
  const router = useRouter();
  const [state, setState] = useState<TracksState>({ active: null, tracks: {} });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(getTracks());
    setMounted(true);
    const t = new URLSearchParams(window.location.search).get('t');
    if (t && trackById(t) && !getTracks().active) startTrack(t).then(() => setState(getTracks()));
    const on = () => setState(getTracks());
    window.addEventListener('norica-trilhas', on);
    return () => window.removeEventListener('norica-trilhas', on);
  }, []);

  const info = todayStep(state);
  const active = trackById(state.active);
  const tone = TONE[active?.color ?? 'emerald'];

  const done = () => {
    if (completeToday()) {
      try { confetti({ particleCount: 70, spread: 60, origin: { y: 0.75 }, colors: ['#34d399', '#38bdf8', '#fbbf24'] }); } catch (_e) {}
    }
    setState(getTracks());
  };

  return (
    <main className="min-h-[100dvh] bg-[#021013] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="trilhas">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-7">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-emerald-400/80 uppercase tracking-[0.25em]">Trilhas de 7 dias</span>
        </div>

        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Um passo <span className="text-emerald-400 italic">por dia.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Escolha um objetivo. Cada dia libera uma tarefa curta — e às 19h a Nórica te lembra.</p>
        </div>

        {mounted && active && info && (
          <section className={`p-6 rounded-[2.5rem] border ${tone.border} ${tone.bg} space-y-5`} data-testid="trilha-ativa">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.25em] ${tone.text}`}>{active.emoji} {active.title}</p>
                <p className="text-xs text-white/50 font-bold mt-1">{info.finished ? 'Trilha completa!' : `Dia ${info.index + 1} de ${active.steps.length}`}</p>
              </div>
              <div className="flex gap-1">
                {active.steps.map((_, i) => (
                  <span key={i} className={`h-1.5 w-4 rounded-full ${i < (state.tracks[active.id]?.done.length ?? 0) ? tone.bar : 'bg-white/15'}`} />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {info.finished ? (
                <motion.div key="fim" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <h2 className="text-2xl font-black tracking-tight">Você completou os 7 dias. 🎉</h2>
                  <p className="text-sm text-white/65 font-semibold leading-relaxed">Constância é cuidado. Que tal escolher a próxima trilha?</p>
                  <button onClick={() => leaveTrack().then(() => setState(getTracks()))} className="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest">Escolher outra</button>
                </motion.div>
              ) : info.step && (
                <motion.div key={info.index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <h2 className="text-2xl font-black tracking-tight leading-tight">{info.step.title}</h2>
                  <p className="text-sm text-white/65 font-semibold leading-relaxed">{info.step.text}</p>
                  <div className="p-4 rounded-2xl bg-black/25 border border-white/10">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Tarefa de hoje</p>
                    <p className="text-[15px] font-bold text-white/90 leading-snug">{info.step.action}</p>
                  </div>
                  {info.step.link && (
                    <button onClick={() => router.push(info.step!.link!.href)} className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${tone.text}`}>
                      {info.step.link.label} <ChevronRight size={14} />
                    </button>
                  )}
                  {info.doneToday ? (
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 size={16} /> Feito hoje! O próximo passo libera amanhã.</p>
                  ) : (
                    <button onClick={done} className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[11px]">Fiz o passo de hoje</button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {!info.finished && (
              <button onClick={() => leaveTrack().then(() => setState(getTracks()))} className="text-[10px] font-black text-white/35 uppercase tracking-widest">Pausar trilha</button>
            )}
          </section>
        )}

        <div className="space-y-3">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{active ? 'Outras trilhas' : 'Escolha sua trilha'}</p>
          {TRACKS.filter((t) => t.id !== active?.id).map((t) => {
            const p = state.tracks[t.id];
            const c = TONE[t.color];
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => startTrack(t.id).then(() => { setState(getTracks()); window.scrollTo({ top: 0, behavior: 'smooth' }); })}
                className="w-full text-left p-5 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-4"
              >
                <div className={`w-14 h-14 rounded-2xl border ${c.border} ${c.bg} flex items-center justify-center text-2xl shrink-0`}>{t.emoji}</div>
                <div className="flex-1">
                  <h2 className="text-sm font-black uppercase tracking-tighter">{t.title}</h2>
                  <p className="text-[12px] text-white/55 font-semibold leading-snug mt-1">{t.subtitle}</p>
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-2 ${c.text}`}>
                    {p ? `${Math.min(p.done.length, 7)}/7 feitos · ${active ? 'trocar para esta' : 'continuar'}` : '7 dias · poucos minutos'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-white/30" />
              </motion.button>
            );
          })}
        </div>

        <p className="flex items-start gap-2 text-[11px] text-white/35 font-semibold leading-relaxed">
          <Sparkles size={14} className="shrink-0 mt-0.5" /> As trilhas ajudam a criar hábitos, mas não substituem acompanhamento profissional. Se estiver difícil, o S.O.S está a um toque.
        </p>
      </div>
    </main>
  );
}
