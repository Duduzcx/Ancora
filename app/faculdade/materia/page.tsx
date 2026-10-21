"use client";

// Página da matéria (estilo Notion, simples): página livre com títulos, listas e tarefas,
// "a fazer" com prazos, datas (provas/trabalhos) com notas e média, e as anotações do Caderno.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Eye, Heading1, Heading2, List, CheckSquare, Plus, Trash2, Clock, MapPin, Archive, NotebookPen, Sparkles, ChevronDown, Loader2 } from 'lucide-react';
import {
  average, cachedFaculdade, colorOf, countdown, deleteCourse, deleteTask, isoDay, loadFaculdade, PAGE_TEMPLATES, parsePage,
  saveCourse, savePage, saveTask, toggleTodo, WEEKDAYS, type Course, type CourseEvent, type Faculdade,
} from '@/lib/faculdade';
import { CourseSheet, EventSheet } from '@/components/faculdade/Sheets';
import EventRow from '@/components/faculdade/EventRow';
import { noricaApi, type StudyNote } from '@/lib/norica-api';

type Tab = 'pagina' | 'fazer' | 'datas' | 'anotacoes';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export default function MateriaPage() {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [f, setF] = useState<Faculdade | null>(null);
  const [tab, setTab] = useState<Tab>('pagina');
  const [edit, setEdit] = useState(false);
  const [courseSheet, setCourseSheet] = useState(false);
  const [eventSheet, setEventSheet] = useState<{ event: CourseEvent | null } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setId(q.get('id'));
    if (q.get('aba') && ['pagina', 'fazer', 'datas', 'anotacoes'].includes(q.get('aba')!)) setTab(q.get('aba') as Tab);
    setF(cachedFaculdade());
    loadFaculdade().then(setF).catch(() => {});
    const on = () => setF(cachedFaculdade());
    window.addEventListener('norica-faculdade', on);
    return () => window.removeEventListener('norica-faculdade', on);
  }, []);

  const course = f?.courses.find((c) => c.id === id) ?? null;
  const events = useMemo(() => (f?.events ?? []).filter((e) => e.course_id === id).sort((a, b) => a.day.localeCompare(b.day)), [f, id]);
  const tasks = useMemo(() => (f?.tasks ?? []).filter((t) => t.course_id === id), [f, id]);

  if (f && !course) {
    return (
      <main className="min-h-[100dvh] text-white px-6 pt-[calc(env(safe-area-inset-top)+3rem)] text-center space-y-4">
        <p className="text-lg font-black">Matéria não encontrada.</p>
        <button onClick={() => router.push('/faculdade/')} className="text-[11px] font-black uppercase tracking-widest text-emerald-300 underline underline-offset-4">Voltar para a Faculdade</button>
      </main>
    );
  }
  if (!course) return <main className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-300" /></main>;

  const col = colorOf(course);
  const avg = average(course.id, events);
  // Quanto precisa tirar nas avaliações que faltam para passar.
  const graded = events.filter((e) => e.grade != null);
  const pending = events.filter((e) => e.grade == null && (e.kind === 'prova' || e.kind === 'trabalho' || e.kind === 'apresentacao'));
  const wG = graded.reduce((s, e) => s + e.weight, 0);
  const wP = pending.reduce((s, e) => s + e.weight, 0);
  const sumG = graded.reduce((s, e) => s + (Number(e.grade) / e.max_grade) * 10 * e.weight, 0);
  const need = wP > 0 && wG > 0 ? (course.pass_grade * (wG + wP) - sumG) / wP : null;

  const archive = async () => {
    if (!window.confirm(course.archived ? 'Trazer a matéria de volta?' : 'Arquivar esta matéria? Ela sai da lista, mas nada é apagado.')) return;
    await saveCourse({ ...course, archived: !course.archived }).catch(() => {});
    router.push('/faculdade/');
  };
  const remove = async () => {
    if (!window.confirm(`Apagar "${course.name}" com a página, tarefas e datas? Isso não pode ser desfeito.`)) return;
    await deleteCourse(course.id).catch(() => {});
    router.push('/faculdade/');
  };

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="materia">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/faculdade/')} className="p-3 bg-white/5 border border-white/10 rounded-full" style={{ color: col.hex }} aria-label="Voltar"><ArrowLeft size={20} /></button>
          <button onClick={() => setCourseSheet(true)} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1.5" data-testid="editar-materia"><Pencil size={12} /> Editar</button>
        </div>

        <section className="space-y-3">
          <span className="block w-12 h-1.5 rounded-full" style={{ background: col.hex }} />
          <h1 className="text-4xl font-black tracking-tighter leading-none" data-testid="materia-titulo">{course.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/55 font-bold">
            {course.professor && <span>👩‍🏫 {course.professor}</span>}
            {course.room && <span className="flex items-center gap-1"><MapPin size={12} /> {course.room}</span>}
          </div>
          {course.schedule.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {course.schedule.map((s, i) => <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1" style={{ background: col.soft, color: col.text }}><Clock size={11} /> {WEEKDAYS[s.dia]} {s.inicio}{s.fim ? `–${s.fim}` : ''}</span>)}
            </div>
          )}
          {(avg !== null || need !== null) && (
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-4" data-testid="media">
              {avg !== null && (
                <div className="text-center shrink-0">
                  <p className="text-3xl font-black tracking-tighter" style={{ color: avg >= course.pass_grade ? '#a7f3d0' : '#fecdd3' }}>{avg.toFixed(1).replace('.', ',')}</p>
                  <p className="text-[9px] font-black text-white/45 uppercase tracking-widest">média</p>
                </div>
              )}
              <p className="text-[12px] text-white/65 font-semibold leading-snug">
                {need === null ? `Para passar: ${String(course.pass_grade).replace('.', ',')}.`
                  : need <= 0 ? 'Você já tem nota para passar. 🎉 Continue firme.'
                  : need > 10 ? 'Mesmo com nota máxima não chega na média. Vale conversar com o(a) professor(a) sobre recuperação.'
                  : `Para passar com ${String(course.pass_grade).replace('.', ',')}, você precisa de ${need.toFixed(1).replace('.', ',')} em média nas próximas avaliações.`}
              </p>
            </div>
          )}
        </section>

        {/* Abas */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
          {([['pagina', 'Página'], ['fazer', `A fazer${tasks.filter((t) => !t.done).length ? ` · ${tasks.filter((t) => !t.done).length}` : ''}`], ['datas', 'Datas'], ['anotacoes', 'Caderno']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`py-2.5 rounded-xl text-[11px] font-black ${tab === k ? 'bg-white/15 text-white' : 'text-white/50'}`} data-testid={`aba-${k}`}>{l}</button>
          ))}
        </div>

        {tab === 'pagina' && <PageEditor key={course.id} course={course} edit={edit} setEdit={setEdit} />}
        {tab === 'fazer' && <Tasks course={course} tasks={tasks} />}
        {tab === 'datas' && (
          <section className="space-y-2">
            {events.length === 0 && <p className="text-[12px] text-white/45 font-semibold">Nenhuma prova ou entrega ainda.</p>}
            <ul className="space-y-2">{events.map((e) => <EventRow key={e.id} e={e} course={course} onClick={() => setEventSheet({ event: e })} />)}</ul>
            <button onClick={() => setEventSheet({ event: null })} className="w-full py-3.5 rounded-2xl border border-dashed border-white/15 text-[10px] font-black uppercase tracking-widest text-white/70 flex items-center justify-center gap-1.5" data-testid="add-data-materia"><Plus size={13} /> Prova, trabalho ou entrega</button>
          </section>
        )}
        {tab === 'anotacoes' && <Notes course={course} />}

        <div className="flex gap-2 pt-4">
          <button onClick={archive} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 flex items-center justify-center gap-1.5"><Archive size={13} /> {course.archived ? 'Desarquivar' : 'Arquivar no fim do semestre'}</button>
          <button onClick={remove} className="px-4 rounded-2xl bg-rose-500/10 border border-rose-400/20 text-rose-200" aria-label="Apagar matéria"><Trash2 size={15} /></button>
        </div>
      </div>

      {courseSheet && <CourseSheet course={course} open onClose={() => setCourseSheet(false)} onSaved={() => setF(cachedFaculdade())} />}
      {eventSheet && <EventSheet event={eventSheet.event} courses={f?.courses ?? []} defaultCourse={course.id} open onClose={() => setEventSheet(null)} onSaved={() => setF(cachedFaculdade())} />}
    </main>
  );
}

// ---------------------------------------------------------------------
// Página livre (títulos, listas e tarefas), salva sozinha
// ---------------------------------------------------------------------

function PageEditor({ course, edit, setEdit }: { course: Course; edit: boolean; setEdit: (v: boolean) => void }) {
  const [text, setText] = useState(course.page ?? '');
  const [status, setStatus] = useState<'salvo' | 'salvando' | 'erro' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  // Posição do cursor depois de mudar o texto pelo teclado/botões (antes da próxima tecla).
  useLayoutEffect(() => {
    if (caret.current !== null && ta.current) { ta.current.focus(); ta.current.setSelectionRange(caret.current, caret.current); caret.current = null; }
  }, [text]);

  const persist = (v: string) => {
    setStatus('salvando');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { savePage(course.id, v).then(() => setStatus('salvo')).catch(() => setStatus('erro')); }, 800);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Chegou a versão do servidor e a pessoa ainda não mexeu: mostra a mais nova.
  useEffect(() => { if (status === null) setText(course.page ?? ''); }, [course.page]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (v: string) => { setText(v); persist(v); };

  // Coloca o marcador no começo da linha onde está o cursor.
  const prefix = (p: string) => {
    const el = ta.current; if (!el) return;
    const pos = el.selectionStart; const start = text.lastIndexOf('\n', pos - 1) + 1;
    const line = text.slice(start).split('\n')[0];
    const clean = line.replace(/^(#{1,2}\s+|\s*[-•*]\s+|\s*\[( |x|X)\]\s?)/, '');
    const v = text.slice(0, start) + p + clean + text.slice(start + line.length);
    caret.current = start + p.length + clean.length;
    change(v);
  };
  // Enter numa lista continua a lista.
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const el = e.currentTarget; const pos = el.selectionStart; const start = text.lastIndexOf('\n', pos - 1) + 1;
    const line = text.slice(start, pos);
    const m = line.match(/^(\s*[-•*]\s+|\s*\[( |x|X)\]\s?)/);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === m[0].trim()) { caret.current = start; change(text.slice(0, start) + text.slice(pos)); return; }
    const marker = m[0].includes('[') ? '[ ] ' : m[0];
    caret.current = pos + 1 + marker.length;
    change(text.slice(0, pos) + '\n' + marker + text.slice(pos));
  };

  const blocks = parsePage(text);
  return (
    <section className="space-y-3" data-testid="pagina">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{status === 'salvando' ? 'Salvando…' : status === 'salvo' ? 'Salvo ✓' : status === 'erro' ? 'Sem internet — tente de novo' : 'Página da matéria'}</span>
        <button onClick={() => setEdit(!edit)} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" data-testid="pagina-modo">{edit ? <><Eye size={12} /> Ver</> : <><Pencil size={12} /> Escrever</>}</button>
      </div>

      {edit ? (
        <>
          <div className="flex gap-1.5">
            {[{ p: '# ', i: Heading1, l: 'Título' }, { p: '## ', i: Heading2, l: 'Subtítulo' }, { p: '- ', i: List, l: 'Lista' }, { p: '[ ] ', i: CheckSquare, l: 'Tarefa' }].map((b) => (
              <button key={b.l} onMouseDown={(e) => e.preventDefault()} onClick={() => prefix(b.p)} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black flex flex-col items-center gap-0.5 text-white/70" aria-label={b.l}><b.i size={15} /> {b.l}</button>
            ))}
          </div>
          <textarea ref={ta} value={text} onChange={(e) => change(e.target.value)} onKeyDown={onKey} rows={14} maxLength={20000}
            placeholder={'# Título\n- item de lista\n[ ] tarefa para marcar'}
            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-white/25 placeholder:text-white/25 resize-y font-medium" data-testid="pagina-texto" />
        </>
      ) : !text.trim() ? (
        <div className="p-5 rounded-[1.75rem] border border-dashed border-white/15 space-y-3">
          <p className="text-[13px] text-white/60 font-semibold">Uma página só desta matéria, do seu jeito. Comece com um modelo:</p>
          <div className="flex flex-wrap gap-1.5">
            {PAGE_TEMPLATES.map((t) => <button key={t.label} onClick={() => { change(t.text); setEdit(true); }} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold" data-testid="modelo">{t.label}</button>)}
            <button onClick={() => setEdit(true)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold">Em branco</button>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-[1.75rem] bg-white/[0.04] border border-white/10 space-y-1.5" data-testid="pagina-ver">
          {blocks.map((b) => {
            if (b.type === 'gap') return <div key={b.line} className="h-2" />;
            if (b.type === 'h1') return <h2 key={b.line} className="text-xl font-black tracking-tight pt-2 first:pt-0">{b.text}</h2>;
            if (b.type === 'h2') return <h3 key={b.line} className="text-[13px] font-black uppercase tracking-wider text-white/60 pt-2">{b.text}</h3>;
            if (b.type === 'li') return <p key={b.line} className="flex gap-2 text-[14px] text-white/85 leading-relaxed"><span className="text-white/40">•</span><span>{b.text || <span className="text-white/25">…</span>}</span></p>;
            if (b.type === 'todo') return (
              <button key={b.line} onClick={() => change(toggleTodo(text, b.line))} className="w-full flex gap-2.5 items-start text-left text-[14px] leading-relaxed" data-testid="pagina-tarefa">
                <span className={`mt-1 w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center ${b.checked ? 'bg-emerald-400 border-emerald-400 text-slate-950' : 'border-white/30'}`}>{b.checked && <span className="text-[10px] font-black">✓</span>}</span>
                <span className={b.checked ? 'line-through text-white/40' : 'text-white/85'}>{b.text || <span className="text-white/30">tarefa</span>}</span>
              </button>
            );
            return <p key={b.line} className="text-[14px] text-white/85 leading-relaxed">{b.text}</p>;
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// A fazer
// ---------------------------------------------------------------------

function Tasks({ course, tasks }: { course: Course; tasks: Faculdade['tasks'] }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = isoDay();
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const done = tasks.filter((t) => t.done);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try { await saveTask({ course_id: course.id, title, due: due || null }); setTitle(''); setDue(''); } catch (_e) {} finally { setBusy(false); }
  };
  return (
    <section className="space-y-3" data-testid="tarefas">
      <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} maxLength={140} placeholder="Ex.: Fazer a lista 3" className="w-full bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-white/30" data-testid="tarefa-titulo" />
        <div className="flex gap-2">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[12px] [color-scheme:dark]" aria-label="Prazo" />
          <button onClick={add} disabled={!title.trim() || busy} className="px-4 rounded-xl bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" data-testid="tarefa-add">Adicionar</button>
        </div>
      </div>
      {open.length === 0 && <p className="text-[12px] text-white/45 font-semibold px-1">Nada pendente. ✨</p>}
      <ul className="space-y-1.5">
        {open.map((t) => (
          <li key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10" data-testid="tarefa">
            <button onClick={() => saveTask({ ...t, done: true }).catch(() => {})} className="w-5 h-5 rounded-md border-2 border-white/30 shrink-0" aria-label={`Concluir ${t.title}`} />
            <span className="flex-1 min-w-0 text-[13px] font-semibold">{t.title}</span>
            {t.due && <span className={`text-[10px] font-black uppercase shrink-0 ${t.due < today ? 'text-rose-300' : t.due === today ? 'text-amber-300' : 'text-white/45'}`}>{t.due < today ? 'atrasada' : countdown(t.due)}</span>}
            <button onClick={() => deleteTask(t.id).catch(() => {})} className="p-1 text-white/25" aria-label="Apagar tarefa"><Trash2 size={13} /></button>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1">Concluídas ({done.length}) <ChevronDown size={12} className={showDone ? 'rotate-180' : ''} /></button>
          {showDone && (
            <ul className="space-y-1 mt-2">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <button onClick={() => saveTask({ ...t, done: false }).catch(() => {})} className="w-5 h-5 rounded-md bg-emerald-400 text-slate-950 text-[10px] font-black shrink-0" aria-label={`Reabrir ${t.title}`}>✓</button>
                  <span className="flex-1 text-[13px] text-white/40 line-through">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Anotações do Caderno desta matéria
// ---------------------------------------------------------------------

function Notes({ course }: { course: Course }) {
  const router = useRouter();
  const [notes, setNotes] = useState<StudyNote[] | null>(null);
  useEffect(() => {
    noricaApi.studyNoteList().then((r) => setNotes(r.notes.filter((n) => norm(n.subject) === norm(course.name)))).catch(() => setNotes([]));
  }, [course.name]);
  return (
    <section className="space-y-3" data-testid="anotacoes">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => router.push(`/caderno/?materia=${encodeURIComponent(course.name)}`)} className="py-3.5 rounded-2xl bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5" data-testid="anotar-materia"><NotebookPen size={13} /> Anotar</button>
        <button onClick={() => router.push('/caderno/estudar/')} className="py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Sparkles size={13} /> Estudar com IA</button>
      </div>
      <p className="text-[11px] text-white/40 font-semibold px-1">As anotações do Caderno com a matéria “{course.name}” aparecem aqui, e viram cartões para você relembrar.</p>
      {notes === null ? <Loader2 size={16} className="animate-spin text-white/40" /> : notes.length === 0 ? (
        <p className="text-[12px] text-white/45 font-semibold px-1">Nenhuma anotação desta matéria ainda.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="p-4 rounded-[1.5rem] bg-white/5 border border-white/10">
              <p className="text-[14px] font-black leading-snug">{n.title}</p>
              <p className="text-[12px] text-white/55 font-semibold leading-snug mt-0.5 line-clamp-3">{n.summary || n.content}</p>
              {n.cards > 0 && <p className="text-[10px] font-bold text-emerald-200 mt-1.5">📒 {n.cards} cartões</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
