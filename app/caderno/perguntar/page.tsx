"use client";

// "O que eu anotei sobre…?": a Nórica procura nas anotações da pessoa e responde só com o que
// está lá, mostrando de qual anotação tirou cada parte.

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MessageCircleQuestion, Send, FileText } from 'lucide-react';
import { noricaApi, type StudyNote, type StudySource } from '@/lib/norica-api';
import { kindInfo } from '@/lib/caderno';

type QA = { q: string; answer?: string; sources?: StudySource[]; aiNote?: string; error?: string };

export default function PerguntarPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [list, setList] = useState<QA[]>([]);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, StudyNote>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    noricaApi.studyNoteList().then((r) => { setNotes(Object.fromEntries(r.notes.map((n) => [n.id, n]))); setSubjects(r.subjects.slice(0, 4)); }).catch(() => {});
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [list]);

  const ask = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ(''); setBusy(true);
    setList((l) => [...l, { q: question }]);
    try {
      const r = await noricaApi.studyAsk(question);
      setList((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, answer: r.answer, sources: r.sources, aiNote: r.aiNote } : x)));
    } catch (e: any) {
      setList((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, error: e?.message || 'Não foi possível procurar agora.' } : x)));
    } finally {
      setBusy(false);
    }
  };

  const suggestions = subjects.length
    ? subjects.map((s) => `O que eu anotei sobre ${s}?`)
    : ['O que eu aprendi essa semana?', 'Quais ideias eu anotei?', 'O que eu não posso esquecer?'];

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-48 text-white" data-testid="perguntar">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.replace('/caderno/')} className="p-3 bg-white/5 border border-white/10 rounded-full text-sky-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-sky-300/80 uppercase tracking-[0.25em]"><MessageCircleQuestion size={12} /> Perguntar ao Caderno</span>
        </div>

        {list.length === 0 && (
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter leading-none">O que eu <span className="text-sky-300 italic">anotei sobre…?</span></h1>
            <p className="text-sm text-white/55 font-semibold leading-relaxed">Pergunte com suas palavras. A Nórica procura nas suas anotações e responde só com o que você guardou.</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="w-full text-left px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[13px] font-bold text-white/75">{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5" data-testid="respostas">
          {list.map((x, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end"><p className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md bg-sky-500/20 border border-sky-300/20 text-[14px] font-semibold">{x.q}</p></div>
              {x.answer === undefined && !x.error ? (
                <p className="flex items-center gap-2 text-[12px] text-white/45 font-semibold"><Loader2 size={13} className="animate-spin" /> Procurando no seu Caderno…</p>
              ) : x.error ? (
                <p className="text-[12px] text-rose-300 font-bold">{x.error}</p>
              ) : (
                <div className="p-4 rounded-2xl rounded-bl-md bg-white/5 border border-white/10 space-y-3" data-testid="resposta-caderno">
                  <p className="text-[14px] text-white/85 font-medium leading-relaxed whitespace-pre-wrap">{x.answer}</p>
                  {!!x.sources?.length && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">De onde veio</p>
                      {x.sources.map((s, j) => {
                        const n = notes[s.id]; const key = `${i}-${s.id}`;
                        return (
                          <div key={s.id}>
                            <button onClick={() => setOpen(open === key ? null : key)} className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl bg-black/25 border border-white/5">
                              <span className="text-[10px] font-black text-sky-300 shrink-0">[{j + 1}]</span>
                              <FileText size={12} className="shrink-0" style={{ color: kindInfo(s.kind).dot }} />
                              <span className="text-[12px] font-bold truncate">{s.title}</span>
                              {s.subject && <span className="ml-auto text-[10px] text-white/40 font-bold shrink-0">{s.subject}</span>}
                            </button>
                            {open === key && n && <p className="mt-1 px-3 py-2 text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap card-in">{n.content}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {x.aiNote && <p className="text-[11px] text-amber-200/80 font-semibold">{x.aiNote}</p>}
                </div>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-20 px-6">
        <div className="max-w-md mx-auto flex gap-2 p-2 rounded-2xl bg-[#071a1f] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} maxLength={400} placeholder="Ex.: o que eu anotei sobre a prova de física?"
            className="flex-1 min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-white/30" data-testid="pergunta" />
          <button onClick={() => ask()} disabled={!q.trim() || busy} className="w-11 h-11 rounded-xl bg-sky-300 text-slate-950 flex items-center justify-center disabled:opacity-40" aria-label="Perguntar">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </main>
  );
}
