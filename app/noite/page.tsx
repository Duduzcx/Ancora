"use client";

// Modo noite: para quando o sono não vem.
// Tela bem escura (sem luz forte nos olhos), respiração lenta 4-6, "esvaziar a mente"
// (escrever o que está rodando na cabeça e deixar guardado para amanhã) e sons com timer.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Moon, Wind, NotebookPen, Loader2, CheckCircle2, LifeBuoy } from 'lucide-react';
import { noricaApi } from '@/lib/norica-api';
import { HelpSheet } from '@/components/AjudaAgora';
import SonsAmbiente from '@/components/SonsAmbiente';

// Estrelas fixas (posição %, tamanho px, duração e atraso do brilho): leve, só opacidade.
const STARS: [number, number, number, number, number][] = [
  [8, 6, 2, 3.2, 0], [22, 14, 1.5, 4.1, 1.2], [37, 4, 2, 2.8, 0.6], [55, 11, 1.5, 3.6, 2], [71, 5, 2.5, 4.4, 0.3],
  [86, 13, 1.5, 3.1, 1.7], [93, 3, 2, 2.6, 0.9], [14, 22, 1.5, 3.9, 2.4], [63, 20, 1.5, 3.3, 1.1], [44, 26, 1, 4.6, 0.2],
  [79, 27, 2, 3.7, 2.8], [5, 33, 1, 2.9, 1.5],
];

const TIPS = [
  'Tudo bem não dormir agora. Descansar de olhos fechados também recupera.',
  'Se passar de 20 minutos acordado(a), levante, fique no escuro e volte quando o sono chegar.',
  'Evite olhar as horas. O relógio costuma acordar a ansiedade.',
  'Deixe o celular longe da mão depois de ligar o som.',
];

function SlowBreath() {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [cycles, setCycles] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase((p) => (p === 'in' ? 'out' : 'in'));
      if (phase === 'out') setCycles((c) => c + 1);
    }, phase === 'in' ? 4000 : 6000);
    return () => clearTimeout(t);
  }, [phase]);
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <motion.div
          animate={{ scale: phase === 'in' ? 1.35 : 0.85, opacity: phase === 'in' ? 0.45 : 0.18 }}
          transition={{ duration: phase === 'in' ? 4 : 6, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-indigo-400/30 blur-2xl"
        />
        <motion.div
          animate={{ scale: phase === 'in' ? 1.2 : 0.8 }}
          transition={{ duration: phase === 'in' ? 4 : 6, ease: 'easeInOut' }}
          className="w-32 h-32 rounded-full border border-indigo-300/20 bg-indigo-500/5 flex items-center justify-center"
        >
          <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-200/70">{phase === 'in' ? 'Inspira' : 'Solta'}</span>
        </motion.div>
      </div>
      <p className="text-xs font-semibold text-indigo-100/40 text-center">Inspire em 4, solte em 6. Soltar mais devagar avisa o corpo que é hora de descansar.{cycles > 0 ? ` · ${cycles} ciclo${cycles > 1 ? 's' : ''}` : ''}</p>
    </div>
  );
}

export default function NoitePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'respirar' | 'esvaziar'>('respirar');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setBackgroundColor({ color: '#03030a' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (_e) {}
    })();
    const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 12000);
    return () => clearInterval(t);
  }, []);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      const r = await noricaApi.journalSave('noite', text.trim(), 'Esvaziar a mente antes de dormir');
      if (r.crisis) setHelpOpen(true);
      setSaved(true);
      setText('');
    } catch (_e) {
      setFailed(true); // o texto continua na caixa para tentar de novo
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#03030a] text-white relative overflow-x-hidden px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-36 font-sans" data-testid="noite">
      {/* Céu noturno discreto (só opacidade/transform, leve) */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(67,56,202,0.18)_0%,transparent_60%)]" />
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        {STARS.map((st, i) => (
          <span key={i} className="twinkle absolute rounded-full bg-white" style={{ left: `${st[0]}%`, top: `${st[1]}%`, width: st[2], height: st[2], ['--d' as any]: `${st[3]}s`, ['--delay' as any]: `${st[4]}s` }} />
        ))}
      </div>
      <div className="relative z-10 max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-indigo-200/80" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-indigo-300/70 uppercase tracking-[0.25em]">Modo noite</span>
            <span className="text-xs font-bold text-white/40">Para quando o sono não vem</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-200 flex items-center justify-center"><Moon size={22} /></div>
          <h1 className="text-3xl font-black tracking-tighter text-white/90 leading-tight">Vamos desacelerar.</h1>
        </div>

        <AnimatePresence mode="wait">
          <motion.p key={tip} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="text-sm text-indigo-100/50 font-semibold leading-relaxed min-h-[3rem]">
            {TIPS[tip]}
          </motion.p>
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/5">
          {([['respirar', 'Respirar', Wind], ['esvaziar', 'Esvaziar a mente', NotebookPen]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${tab === id ? 'bg-indigo-500/20 text-indigo-100' : 'text-white/40'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'respirar' ? (
          <SlowBreath />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white/50 font-semibold leading-relaxed">
              Escreva tudo o que está rodando na cabeça: preocupações, tarefas de amanhã, qualquer coisa. Fica guardado no seu diário — amanhã você resolve.
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setSaved(false); }}
              rows={6}
              placeholder="O que está na sua cabeça agora…"
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white/90 outline-none focus:border-indigo-400/40 placeholder:text-white/20 resize-none"
            />
            <button onClick={save} disabled={saving || !text.trim()} className="w-full py-4 rounded-2xl bg-indigo-500/80 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Guardar para amanhã
            </button>
            {failed && <p className="text-xs font-bold text-rose-300/80">Sem conexão agora. O texto continua aqui; tente guardar de novo.</p>}
            {saved && (
              <p className="flex items-center gap-2 text-xs font-bold text-indigo-200/70"><CheckCircle2 size={14} /> Guardado. Agora a cabeça pode descansar. 🌙</p>
            )}
          </div>
        )}

        <SonsAmbiente defaultTimer={30} />

        <button onClick={() => setHelpOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-rose-300/70">
          <LifeBuoy size={14} /> Está difícil demais? Peça ajuda agora
        </button>
      </div>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
