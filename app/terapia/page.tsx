"use client";

// Agenda da terapia: lembrete da consulta e "o que quero levar hoje",
// com sugestões tiradas do que a pessoa registrou na Nórica.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, Plus, Check, X, Sparkles, NotebookPen, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { noricaApi } from '@/lib/norica-api';
import { getTherapy, newNoteId, saveTherapy, scheduleTherapy, type Repeat, type TherapyState } from '@/lib/terapia';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nice = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

const BASE_IDEAS = ['Como foi minha semana, em uma palavra', 'O que mais me ajudou nos últimos dias', 'Uma situação que eu quero entender melhor'];

export default function TerapiaPage() {
  const router = useRouter();
  const [s, setS] = useState<TherapyState | null>(null);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [after, setAfter] = useState('');
  const [afterBusy, setAfterBusy] = useState(false);
  const [afterMsg, setAfterMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const st = getTherapy();
    setS(st);
    setWhen(toLocalInput(st.next));
    // Sugestões a partir do diário recente (resumos curtos, nunca o texto inteiro).
    noricaApi.journalList(6).then(({ entries }) => {
      const fromJournal = entries
        .filter((e) => e.kind !== 'terapia' && (e.title || e.summary))
        .slice(0, 4)
        .map((e) => `Falar sobre: ${(e.title || e.summary).replace(/\.$/, '').slice(0, 70)}`);
      setIdeas([...fromJournal, ...BASE_IDEAS]);
    }).catch(() => setIdeas(BASE_IDEAS));
  }, []);

  const update = (next: TherapyState) => { setS(next); saveTherapy(next); };

  const saveDate = async () => {
    if (!s) return;
    const next = { ...s, next: when ? new Date(when).toISOString() : null };
    update(next);
    await scheduleTherapy(next);
    setSavedMsg(next.next ? `Combinado! Te lembro ${next.dayBefore ? 'na véspera' : ''}${next.dayBefore && next.twoHours ? ' e ' : ''}${next.twoHours ? '2h antes' : ''}.` : 'Consulta removida.');
    setTimeout(() => setSavedMsg(null), 5000);
  };

  const addNote = (text: string) => {
    if (!s || !text.trim()) return;
    if (s.notes.some((n) => n.text === text.trim())) return;
    update({ ...s, notes: [...s.notes, { id: newNoteId(), text: text.trim().slice(0, 200), done: false }] });
    setNote('');
  };

  const saveAfter = async () => {
    if (!after.trim()) return;
    setAfterBusy(true);
    try {
      await noricaApi.journalSave('terapia', after.trim(), 'O que ficou da sessão');
      setAfter('');
      setAfterMsg('Guardado no seu diário. 💚');
      if (s) update({ ...s, notes: s.notes.filter((n) => !n.done) });
    } catch (_e) {
      setAfterMsg('Sem conexão agora. O texto continua aqui.');
    } finally {
      setAfterBusy(false);
    }
  };

  if (!s) return null;

  return (
    <main className="min-h-[100dvh] bg-[#021013] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="terapia">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.10)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-sky-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-sky-300/80 uppercase tracking-[0.25em]">Agenda da terapia</span>
        </div>

        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Chegue na sessão <span className="text-sky-300 italic">com a pauta.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Lembrete da consulta e uma lista do que você quer levar. Fica só no seu celular.</p>
        </div>

        <section className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <CalendarClock size={20} className="text-sky-300" />
            <h2 className="text-sm font-black uppercase tracking-widest text-sky-300">Próxima consulta</h2>
          </div>
          {s.next && <p className="text-lg font-black first-letter:uppercase" data-testid="proxima">{nice(s.next)}</p>}
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-sky-400/50 [color-scheme:dark]" aria-label="Data e hora da consulta" />
          <div className="grid grid-cols-3 gap-2">
            {(['nenhuma', 'semanal', 'quinzenal'] as Repeat[]).map((r) => (
              <button key={r} onClick={() => update({ ...s, repeat: r })} className={`py-2.5 rounded-xl border text-[10px] font-black capitalize ${s.repeat === r ? 'bg-sky-500/20 border-sky-400/40 text-sky-100' : 'bg-white/5 border-white/10 text-white/50'}`}>{r === 'nenhuma' ? 'Só esta' : r}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {([['dayBefore', 'Avisar na véspera'], ['twoHours', 'Avisar 2h antes']] as const).map(([k, label]) => (
              <button key={k} onClick={() => update({ ...s, [k]: !s[k] })} className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[11px] font-bold ${s[k] ? 'bg-sky-500/15 border-sky-400/30 text-sky-100' : 'border-white/10 text-white/40'}`}>
                {s[k] ? <Check size={12} /> : <X size={12} />} {label}
              </button>
            ))}
          </div>
          <button onClick={saveDate} className="w-full py-4 rounded-2xl bg-sky-400 text-slate-950 font-black uppercase tracking-widest text-[11px]">Salvar consulta</button>
          {savedMsg && <p className="text-xs font-bold text-sky-200">{savedMsg}</p>}
        </section>

        <section className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <NotebookPen size={20} className="text-emerald-300" />
            <h2 className="text-sm font-black uppercase tracking-widest text-emerald-300">O que quero levar</h2>
          </div>
          {s.notes.length === 0 && <p className="text-sm text-white/45 font-semibold">Nada ainda. Anote durante a semana o que vier à cabeça.</p>}
          <ul className="space-y-2" data-testid="pauta">
            {s.notes.map((n) => (
              <li key={n.id} className="flex items-center gap-3 p-3 rounded-2xl bg-black/25 border border-white/5">
                <button onClick={() => update({ ...s, notes: s.notes.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)) })} aria-label="Marcar como conversado" className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${n.done ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-white/20'}`}>
                  {n.done && <Check size={14} />}
                </button>
                <span className={`flex-1 text-sm font-semibold ${n.done ? 'line-through text-white/35' : 'text-white/85'}`}>{n.text}</span>
                <button onClick={() => update({ ...s, notes: s.notes.filter((x) => x.id !== n.id) })} aria-label="Remover" className="p-1 text-white/30"><X size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote(note)} placeholder="Ex.: a briga com meu irmão" maxLength={200} className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50 placeholder:text-white/25" />
            <button onClick={() => addNote(note)} disabled={!note.trim()} className="px-4 rounded-2xl bg-emerald-500 text-slate-950 disabled:opacity-40" aria-label="Adicionar"><Plus size={18} /></button>
          </div>
          {ideas.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest"><Sparkles size={12} /> Sugestões do que você registrou</p>
              <div className="flex flex-wrap gap-2">
                {ideas.filter((i) => !s.notes.some((n) => n.text === i)).slice(0, 6).map((i) => (
                  <button key={i} onClick={() => addNote(i)} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/65 text-left">+ {i}</button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => router.push('/farol/')} className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-sky-300">
            <FileText size={13} /> Levar o relatório do mês (PDF)
          </button>
        </section>

        <section className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-white/70">Depois da sessão</h2>
          <p className="text-sm text-white/50 font-semibold">O que ficou? Uma frase já ajuda a lembrar depois.</p>
          <textarea value={after} onChange={(e) => setAfter(e.target.value)} rows={3} placeholder="Hoje eu percebi que…" className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white/90 outline-none focus:border-white/30 placeholder:text-white/25 resize-none" />
          <button onClick={saveAfter} disabled={afterBusy || !after.trim()} className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            {afterBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Guardar no diário
          </button>
          {afterMsg && <p className="text-xs font-bold text-emerald-300">{afterMsg}</p>}
        </section>
      </div>
    </main>
  );
}
