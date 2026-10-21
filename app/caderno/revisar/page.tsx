"use client";

// Relembrar: cartões do dia. O que a pessoa erra volta amanhã (e mais uma vez agora, no fim);
// o que acerta volta cada vez mais tarde. É assim que a memória guarda de vez.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, Loader2, RotateCcw, Check, Eye } from 'lucide-react';
import { noricaApi, type StudyCard, type StudyGrade, type StudySummary } from '@/lib/norica-api';
import { refreshStudy } from '@/lib/caderno';

type Item = StudyCard & { retry?: boolean };

const GRADES: { id: StudyGrade; label: string; sub: string; cls: string }[] = [
  { id: 'errei', label: 'Não lembrei', sub: 'volta amanhã', cls: 'bg-rose-500/15 border-rose-400/30 text-rose-100' },
  { id: 'dificil', label: 'Lembrei com esforço', sub: 'volta em breve', cls: 'bg-amber-400/15 border-amber-300/30 text-amber-100' },
  { id: 'facil', label: 'Lembrei fácil', sub: 'volta mais tarde', cls: 'bg-emerald-400/15 border-emerald-300/30 text-emerald-100' },
];

export default function RevisarPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [show, setShow] = useState(false);
  const [summary, setSummary] = useState<StudySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState({ errei: 0, dificil: 0, facil: 0 });

  useEffect(() => {
    noricaApi.studyDue(20).then((r) => { setQueue(r.cards); setTotal(r.cards.length); setSummary(r.summary); })
      .catch((e) => { setErr(e?.message || 'Não foi possível carregar agora.'); setQueue([]); });
  }, []);

  const current = queue?.[0] ?? null;
  const finished = queue !== null && total > 0 && queue.length === 0;

  useEffect(() => {
    if (!finished) return;
    try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: ['#34d399', '#5eead4', '#fbbf24'] }); } catch (_e) {}
    refreshStudy().then((s) => s && setSummary(s));
  }, [finished]);

  const grade = (g: StudyGrade) => {
    if (!current) return;
    if (!current.retry) {
      noricaApi.studyReview(current.id, g).catch(() => {});
      setCounts((c) => ({ ...c, [g]: c[g] + 1 }));
      setDone((d) => d + 1);
    }
    setShow(false);
    setQueue((q) => {
      const rest = (q ?? []).slice(1);
      // Não lembrou: aparece de novo no fim desta revisão, para fixar.
      return g === 'errei' && !current.retry ? [...rest, { ...current, retry: true }] : rest;
    });
  };

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="revisar">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/caderno/')} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.25em]"><RotateCcw size={12} /> Relembrar</span>
        </div>

        {queue === null ? (
          <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-emerald-300" /></div>
        ) : total === 0 ? (
          <section className="pt-10 text-center space-y-4" data-testid="revisar-vazio">
            <div className="w-20 h-20 mx-auto rounded-[2rem] bg-emerald-400/15 text-emerald-300 flex items-center justify-center"><Check size={36} /></div>
            <h1 className="text-3xl font-black tracking-tighter">{err ? 'Não deu para carregar.' : 'Tudo em dia por hoje.'}</h1>
            <p className="text-sm text-white/55 font-semibold leading-relaxed">
              {err || (summary?.cards ? `Você tem ${summary.cards} ${summary.cards === 1 ? 'cartão' : 'cartões'} no Caderno. Eles voltam no dia certo para você não esquecer.` : 'Quando você anota algo que aprendeu, a Nórica cria cartões de revisão. Eles aparecem aqui no dia certo.')}
            </p>
            <button onClick={() => router.push('/caderno/')} className="w-full py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest">Ir para o Caderno</button>
          </section>
        ) : finished ? (
          <section className="pt-10 text-center space-y-4" data-testid="revisar-fim">
            <div className="w-20 h-20 mx-auto rounded-[2rem] bg-emerald-400/15 text-emerald-300 flex items-center justify-center card-in"><Check size={36} /></div>
            <h1 className="text-3xl font-black tracking-tighter">Revisão feita! 🎉</h1>
            <p className="text-sm text-white/60 font-semibold leading-relaxed">
              {done} {done === 1 ? 'cartão revisado' : 'cartões revisados'}. {counts.facil + counts.dificil} lembrados e {counts.errei} para reforçar amanhã.
              {summary?.streak ? ` Você está há ${summary.streak} ${summary.streak === 1 ? 'dia' : 'dias'} seguidos relembrando. 🔥` : ''}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => router.push('/caderno/')} className="py-3.5 rounded-2xl bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-widest">Voltar ao Caderno</button>
              <button onClick={() => router.push('/')} className="py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Início</button>
            </div>
          </section>
        ) : current && (
          <section className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-white/45 uppercase tracking-widest">
                <span>{current.retry ? 'De novo, para fixar' : `${done + 1} de ${total}`}</span>
                {current.subject && <span>{current.subject}</span>}
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>
            </div>

            <button onClick={() => setShow(true)} disabled={show} className="w-full min-h-[18rem] p-6 rounded-[2.25rem] bg-gradient-to-br from-emerald-950/70 to-[#0b0f19] border border-emerald-300/20 text-left flex flex-col card-in" key={current.id + (current.retry ? 'r' : '')} data-testid="cartao">
              {current.note && <span className="text-[9px] font-black text-emerald-300/70 uppercase tracking-widest">{current.note}</span>}
              <span className="text-2xl font-black tracking-tight leading-snug mt-3">{current.front}</span>
              <span className="flex-1" />
              {show ? (
                <span className="block mt-6 pt-5 border-t border-white/10 card-in" data-testid="resposta">
                  <span className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">Resposta</span>
                  <span className="block text-lg font-bold text-white/90 leading-snug">{current.back}</span>
                </span>
              ) : (
                <span className="mt-6 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70"><Eye size={14} /> Tente lembrar e toque para ver</span>
              )}
            </button>

            {show && (
              <div className="grid grid-cols-3 gap-2 card-in" data-testid="notas-revisao">
                {GRADES.map((g) => (
                  <button key={g.id} onClick={() => grade(g.id)} className={`py-3 px-2 rounded-2xl border text-center ${g.cls}`} data-testid={`grade-${g.id}`}>
                    <span className="block text-[11px] font-black leading-tight">{g.label}</span>
                    <span className="block text-[9px] font-bold opacity-60 mt-1">{current.retry ? 'continuar' : g.sub}</span>
                  </button>
                ))}
              </div>
            )}
            {!show && <p className="text-center text-[11px] text-white/35 font-semibold">Tentar lembrar antes de ver é o que fixa na memória. 🧠</p>}
          </section>
        )}
      </div>
    </main>
  );
}
