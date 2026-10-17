"use client";

// Modo fase difícil: a pessoa avisa que está atravessando algo pesado.
// Por algumas semanas: respostas mais gentis no Porto, nada de cobrança de sequência,
// lembretes mais leves e um card de acolhimento na Início. Fica só no aparelho.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, HeartHandshake, Phone } from 'lucide-react';
import { PHASES, PHASE_WEEKS, endPhase, phaseLabel, startPhase, usePhase, type PhaseKind } from '@/lib/fase';

export default function FasePage() {
  const router = useRouter();
  const phase = usePhase();
  const [kind, setKind] = useState<PhaseKind | null>(null);
  const [weeks, setWeeks] = useState(4);
  const daysLeft = phase ? Math.max(1, Math.ceil((phase.until - Date.now()) / 86400_000)) : 0;

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="fase">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-sky-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-sky-200/80 uppercase tracking-[0.25em]">Fase difícil</span>
        </div>

        <div className="space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-sky-400/15 text-sky-200 flex items-center justify-center"><HeartHandshake size={26} /></div>
          <h1 className="text-4xl font-black tracking-tighter leading-none">Tem fases que <span className="text-sky-200 italic">pedem colo.</span></h1>
          <p className="text-sm text-white/60 font-semibold leading-relaxed">Se você está atravessando algo pesado, a Nórica pode ficar mais gentil por algumas semanas.</p>
        </div>

        <ul className="space-y-2 p-5 rounded-[2rem] bg-white/5 border border-white/10">
          {['Respostas no Porto com mais acolhimento e sem metas', 'Sem lembretes de sequência nem "sentimos sua falta"', 'Lembretes do dia mais leves', 'Um card de cuidado na Início'].map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13px] text-white/75 font-semibold"><Check size={15} className="text-sky-300 shrink-0 mt-0.5" /> {t}</li>
          ))}
        </ul>

        {phase ? (
          <section className="p-5 rounded-[2rem] bg-sky-400/10 border border-sky-300/25 space-y-3" data-testid="fase-ligada">
            <p className="text-sm font-black">Modo ligado: {phaseLabel(phase.kind).toLowerCase()}</p>
            <p className="text-[12px] text-white/60 font-semibold">Desliga sozinho em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}. Você pode desligar antes, quando quiser.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => router.push('/porto/')} className="py-3 rounded-2xl bg-sky-300 text-slate-950 text-[10px] font-black uppercase tracking-widest">Conversar</button>
              <button onClick={() => endPhase()} className="py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest" data-testid="desligar-fase">Desligar</button>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">O que está acontecendo? <span className="normal-case tracking-normal text-white/30">(só fica no seu celular)</span></p>
              <div className="flex flex-wrap gap-2">
                {PHASES.map((p) => (
                  <button key={p.id} onClick={() => setKind(p.id)} aria-pressed={kind === p.id} className={`px-3.5 py-2.5 rounded-2xl text-[12px] font-bold border ${kind === p.id ? 'bg-sky-400/15 border-sky-300/40 text-sky-100' : 'bg-white/[0.04] border-white/10 text-white/60'}`}>{p.emoji} {p.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Por quanto tempo</p>
              <div className="grid grid-cols-3 gap-2">
                {PHASE_WEEKS.map((w) => (
                  <button key={w} onClick={() => setWeeks(w)} aria-pressed={weeks === w} className={`py-3 rounded-2xl text-[12px] font-black border ${weeks === w ? 'bg-sky-400/15 border-sky-300/40 text-sky-100' : 'bg-white/[0.04] border-white/10 text-white/55'}`}>{w} semanas</button>
                ))}
              </div>
            </div>
            <button onClick={() => kind && startPhase(kind, weeks)} disabled={!kind} className="w-full py-4 rounded-2xl bg-sky-300 text-slate-950 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" data-testid="ligar-fase">Ligar o modo fase difícil</button>
          </section>
        )}

        <p className="flex items-start gap-2 text-[11px] text-white/40 font-semibold leading-relaxed">
          <Phone size={13} className="shrink-0 mt-0.5" /> Se a dor ficar grande demais, você não precisa esperar: CVV 188 (24h, gratuito) ou SAMU 192. A Nórica não substitui um profissional, e procurar um psicólogo é um ótimo cuidado nessas fases.
        </p>
      </div>
    </main>
  );
}
