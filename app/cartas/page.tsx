"use client";

// Cartas para o futuro: escreva hoje para ler daqui a 7, 30, 90, 180 ou 365 dias.
// A carta fica criptografada e o servidor só libera o texto na data escolhida.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, MailOpen, Loader2, Lock, Trash2, Send, Clock } from 'lucide-react';
import { noricaApi, type FutureLetter } from '@/lib/norica-api';
import { HelpSheet } from '@/components/AjudaAgora';
import { rememberLetters, scheduleLetter } from '@/lib/cartas';

const WHEN = [
  { days: 7, label: '1 semana' },
  { days: 30, label: '1 mês' },
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '1 ano' },
];

const PROMPTS = [
  'Como você está hoje, de verdade?',
  'O que está te preocupando agora — e o que você espera que tenha mudado?',
  'Do que você está orgulhoso(a) nesta semana?',
  'Um conselho para o seu eu do futuro.',
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000));

export default function CartasPage() {
  const router = useRouter();
  const [letters, setLetters] = useState<FutureLetter[] | null>(null);
  const [text, setText] = useState('');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reading, setReading] = useState<FutureLetter | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (openId?: string | null) => {
    try {
      const { letters: list } = await noricaApi.letterList();
      setLetters(list);
      rememberLetters(list);
      const target = openId ? list.find((l) => l.id === openId && l.delivered) : null;
      if (target) open(target);
    } catch (err: any) {
      setLetters([]);
      setError(err?.message || 'Não foi possível carregar suas cartas.');
    }
  };

  useEffect(() => { load(new URLSearchParams(window.location.search).get('id')); }, []);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await noricaApi.letterSave(text.trim(), days);
      await scheduleLetter(r.letter);
      if (r.crisis) setHelpOpen(true);
      setText('');
      setMsg(`Carta guardada. Ela chega em ${fmt(r.letter.deliver_at)}. 💌`);
      load();
    } catch (err: any) {
      setMsg(err?.message || 'Não foi possível guardar agora. O texto continua aqui.');
    } finally {
      setBusy(false);
    }
  };

  const open = async (l: FutureLetter) => {
    setReading(l);
    if (!l.opened) {
      try {
        const r = await noricaApi.letterOpen(l.id);
        setReading(r.letter);
        setLetters((prev) => {
          const next = (prev ?? []).map((x) => (x.id === l.id ? r.letter : x));
          rememberLetters(next);
          return next;
        });
      } catch (_e) {}
    }
  };

  const remove = async (id: string) => {
    await noricaApi.letterDelete(id).catch(() => {});
    setReading(null);
    load();
  };

  const arrived = (letters ?? []).filter((l) => l.delivered);
  const waiting = (letters ?? []).filter((l) => !l.delivered);

  return (
    <main className="min-h-[100dvh] bg-[#021013] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="cartas">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,114,182,0.10)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-7">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-rose-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-rose-300/80 uppercase tracking-[0.25em]">Cartas para o futuro</span>
        </div>

        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Escreva para <span className="text-rose-300 italic">você.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">A carta fica guardada e criptografada. Só dá para abrir no dia que você escolher — e a Nórica avisa quando chegar.</p>
        </div>

        <section className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4">
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => setText((t) => (t ? `${t}\n\n${p}\n` : `${p}\n`))} className="px-3 py-1.5 rounded-full bg-rose-400/10 border border-rose-300/20 text-[11px] font-bold text-rose-100/80 text-left">{p}</button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={4000}
            placeholder="Querido(a) eu do futuro…"
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white/90 outline-none focus:border-rose-300/40 placeholder:text-white/25 resize-none"
          />
          <div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Abrir daqui a</p>
            <div className="grid grid-cols-5 gap-1.5">
              {WHEN.map((w) => (
                <button key={w.days} onClick={() => setDays(w.days)} className={`py-2.5 rounded-xl border text-[10px] font-black ${days === w.days ? 'bg-rose-400/20 border-rose-300/40 text-rose-100' : 'bg-white/5 border-white/10 text-white/50'}`}>{w.label}</button>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={busy || !text.trim()} className="w-full py-4 rounded-2xl bg-rose-400 disabled:opacity-40 text-slate-950 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Guardar carta
          </button>
          {msg && <p className="text-xs font-bold text-rose-100/80">{msg}</p>}
        </section>

        {letters === null ? (
          <div className="space-y-3"><div className="skeleton h-20 rounded-[2rem]" /><div className="skeleton h-20 rounded-[2rem]" /></div>
        ) : (
          <>
            {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
            {arrived.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Chegaram</p>
                {arrived.map((l) => (
                  <button key={l.id} onClick={() => open(l)} className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border text-left ${l.opened ? 'bg-white/5 border-white/10' : 'bg-rose-400/10 border-rose-300/30'}`}>
                    {l.opened ? <MailOpen size={22} className="text-rose-200/60" /> : <Mail size={22} className="text-rose-200 animate-pulse" />}
                    <div className="flex-1">
                      <p className="text-sm font-black">{l.opened ? 'Carta lida' : 'Nova carta para você!'}</p>
                      <p className="text-[11px] text-white/50 font-semibold">Escrita em {fmt(l.created_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {waiting.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">A caminho</p>
                {waiting.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 p-5 rounded-[2rem] bg-white/5 border border-white/10">
                    <Lock size={20} className="text-white/35" />
                    <div className="flex-1">
                      <p className="text-sm font-black">Chega em {fmt(l.deliver_at)}</p>
                      <p className="text-[11px] text-white/45 font-semibold flex items-center gap-1"><Clock size={11} /> faltam {daysLeft(l.deliver_at)} dia(s)</p>
                    </div>
                    <button onClick={() => remove(l.id)} className="p-2 text-white/30" aria-label="Apagar carta"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {reading && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReading(null)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000]" />
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0 }}
              className="fixed inset-x-4 top-[12dvh] bottom-[12dvh] z-[1001] max-w-md mx-auto bg-[#fdf6ec] text-slate-800 rounded-[2rem] p-7 shadow-2xl overflow-y-auto"
              data-testid="carta-aberta"
            >
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">De você, em {fmt(reading.created_at)}</p>
              <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line font-medium">{reading.content ?? '…'}</p>
              <div className="mt-8 flex gap-3">
                <button onClick={() => setReading(null)} className="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">Fechar</button>
                <button onClick={() => remove(reading.id)} className="py-3 px-4 rounded-2xl border border-slate-300 text-slate-500 text-[10px] font-black uppercase tracking-widest">Apagar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
