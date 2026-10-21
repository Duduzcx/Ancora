"use client";

// Estudar com a IA: a pessoa escreve um tema ou cola um texto da aula; a Nórica explica
// de forma simples, lista os pontos-chave e faz um quiz de 3 perguntas. Dá para guardar no Caderno.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles, Check, X, BookmarkPlus, RotateCcw } from 'lucide-react';
import { noricaApi, type StudyLesson } from '@/lib/norica-api';
import { refreshStudy } from '@/lib/caderno';
import { HelpSheet } from '@/components/AjudaAgora';

const EXEMPLOS = ['Fotossíntese', 'Revolução Francesa', 'Equação do 2º grau', 'Como funciona a inflação', 'Orações subordinadas'];

export default function EstudarPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState<StudyLesson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [help, setHelp] = useState(false);

  const ask = async (topic?: string) => {
    const t = (topic ?? text).trim();
    if (!t || busy) return;
    if (topic) setText(topic);
    setBusy(true); setErr(null); setLesson(null); setAnswers({}); setSaved(null);
    try {
      const r = await noricaApi.studyExplain(t);
      if (r.crisis) { setHelp(true); setErr('Parece que algo está pesado agora. Antes de estudar, cuide de você: a ajuda está a um toque. 💙'); return; }
      setLesson(r);
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível preparar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const saveToNotebook = async () => {
    if (!lesson || saving) return;
    setSaving(true);
    try {
      const content = `${lesson.explicacao}\n\nPontos-chave:\n${lesson.topicos.map((t) => `• ${t}`).join('\n')}`;
      const cards = lesson.quiz.map((q) => ({ front: q.pergunta, back: `${q.opcoes[q.correta]}${q.porque ? ` — ${q.porque}` : ''}`.slice(0, 300) }));
      const r = await noricaApi.studyNoteSave({ kind: 'aprendizado', content, title: lesson.titulo, subject: lesson.materia, summary: lesson.topicos[0] ?? '', cards, organize: false });
      setSaved(r.cardsCreated);
      refreshStudy();
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível guardar agora.');
    } finally {
      setSaving(false);
    }
  };

  const answered = Object.keys(answers).length;
  const score = lesson ? lesson.quiz.filter((q, i) => answers[i] === q.correta).length : 0;

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="estudar">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/caderno/')} className="p-3 bg-white/5 border border-white/10 rounded-full text-violet-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-violet-300/80 uppercase tracking-[0.25em]"><Sparkles size={12} /> Estudar com a IA</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter leading-none">O que você quer <span className="text-violet-300 italic">entender?</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Escreva um tema ou cole um trecho da aula. A Nórica explica simples, resume e faz um quiz rapidinho.</p>
        </div>

        <section className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={6000} placeholder="Ex.: o que é fotossíntese — ou cole aqui o resumo da aula"
            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-violet-300/40 placeholder:text-white/25 resize-none leading-relaxed" data-testid="estudar-texto" />
          {!lesson && !busy && (
            <div className="flex flex-wrap gap-1.5">
              {EXEMPLOS.map((e) => <button key={e} onClick={() => ask(e)} className="px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-bold text-white/55">{e}</button>)}
            </div>
          )}
          <button onClick={() => ask()} disabled={!text.trim() || busy} className="w-full py-4 rounded-2xl bg-violet-300 text-slate-950 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2" data-testid="estudar-enviar">
            {busy ? <><Loader2 size={14} className="animate-spin" /> Preparando uma explicação simples…</> : <><Sparkles size={14} /> Me explica</>}
          </button>
          {err && (
            <div className="text-[12px] font-bold text-rose-300 space-y-1" data-testid="estudar-erro">
              <p>{err}</p>
              {/limite|Pro/.test(err) && <button onClick={() => router.push('/planos/')} className="text-[10px] font-black uppercase tracking-widest text-violet-300 underline underline-offset-4">Conhecer o Pro</button>}
            </div>
          )}
        </section>

        {busy && (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />)}</div>
        )}

        {lesson && (
          <section className="space-y-5 card-in" data-testid="aula">
            <div className="p-5 rounded-[2rem] bg-gradient-to-br from-violet-950/50 to-[#0b0f19] border border-violet-300/20 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black tracking-tight">{lesson.titulo}</h2>
                {lesson.materia && <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold">{lesson.materia}</span>}
              </div>
              {lesson.explicacao.split(/\n{2,}/).map((p, i) => <p key={i} className="text-[14px] text-white/85 font-medium leading-relaxed">{p}</p>)}
            </div>

            {lesson.topicos.length > 0 && (
              <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-2">
                <p className="text-[10px] font-black text-violet-300 uppercase tracking-widest">Pontos-chave</p>
                <ul className="space-y-2">
                  {lesson.topicos.map((t) => <li key={t} className="flex gap-2 text-[13px] text-white/80 font-semibold leading-snug"><Check size={15} className="text-violet-300 shrink-0 mt-0.5" /> {t}</li>)}
                </ul>
              </div>
            )}

            {lesson.quiz.length > 0 && (
              <div className="space-y-3" data-testid="quiz">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest px-1">Quiz rápido {answered === lesson.quiz.length && `· ${score} de ${lesson.quiz.length} ${score === lesson.quiz.length ? '🎉' : ''}`}</p>
                {lesson.quiz.map((q, i) => {
                  const a = answers[i];
                  return (
                    <div key={i} className="p-4 rounded-[1.75rem] bg-white/5 border border-white/10 space-y-2">
                      <p className="text-[14px] font-black leading-snug">{i + 1}. {q.pergunta}</p>
                      <div className="space-y-1.5">
                        {q.opcoes.map((o, j) => {
                          const picked = a === j; const right = j === q.correta; const revealed = a !== undefined;
                          return (
                            <button key={j} disabled={revealed} onClick={() => setAnswers((x) => ({ ...x, [i]: j }))}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center gap-2 ${revealed && right ? 'bg-emerald-400/15 border-emerald-300/40 text-emerald-100' : revealed && picked ? 'bg-rose-500/15 border-rose-400/40 text-rose-100' : 'bg-black/20 border-white/10 text-white/75'}`}
                              data-testid={`q${i}-o${j}`}>
                              {revealed && right ? <Check size={14} className="shrink-0" /> : revealed && picked ? <X size={14} className="shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0" />}
                              {o}
                            </button>
                          );
                        })}
                      </div>
                      {a !== undefined && q.porque && <p className="text-[12px] text-white/60 font-semibold leading-snug">{a === q.correta ? 'Isso! ' : 'Quase. '}{q.porque}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {saved !== null ? (
              <div className="p-4 rounded-2xl bg-emerald-400/10 border border-emerald-300/25 text-center space-y-2" data-testid="aula-salva">
                <p className="text-sm font-black text-emerald-100">Guardado no Caderno ✓</p>
                <p className="text-[12px] text-white/60 font-semibold">{saved > 0 ? `${saved} cartões de revisão vão aparecer para você relembrar nos próximos dias.` : 'Está no seu Caderno para reler quando quiser.'}</p>
                <button onClick={() => router.push('/caderno/')} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 underline underline-offset-4">Abrir o Caderno</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={saveToNotebook} disabled={saving} className="py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="aula-salvar">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={13} />} Guardar no Caderno
                </button>
                <button onClick={() => { setLesson(null); setText(''); }} className="py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><RotateCcw size={13} /> Outro tema</button>
              </div>
            )}
            <p className="text-[10px] text-white/30 font-semibold text-center leading-relaxed">A IA pode errar. Na dúvida, confira no material da aula.</p>
          </section>
        )}
      </div>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </main>
  );
}
