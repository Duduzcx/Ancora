"use client";

// Faculdade: o semestre organizado — aulas de hoje, próximas provas e trabalhos, e as matérias.

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, Plus, CalendarDays, Clock, MapPin, Sparkles, Wind, Timer, Check } from 'lucide-react';
import {
  average, cachedFaculdade, classesOn, colorOf, countdown, daysUntil, isoDay, kindOf, loadFaculdade, saveTask, upcoming,
  type Course, type CourseEvent, type Faculdade,
} from '@/lib/faculdade';
import { CourseSheet, EventSheet } from '@/components/faculdade/Sheets';
import EventRow from '@/components/faculdade/EventRow';

export default function FaculdadePage() {
  const router = useRouter();
  const [f, setF] = useState<Faculdade | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [courseSheet, setCourseSheet] = useState(false);
  const [eventSheet, setEventSheet] = useState<{ event: CourseEvent | null } | null>(null);

  const reload = () => loadFaculdade().then((x) => { setF(x); setErr(null); }).catch((e) => setErr(e?.message || 'Não foi possível carregar.'));
  useEffect(() => {
    setF(cachedFaculdade());
    reload();
    const on = () => setF(cachedFaculdade());
    window.addEventListener('norica-faculdade', on);
    return () => window.removeEventListener('norica-faculdade', on);
  }, []);

  const courses = useMemo(() => (f?.courses ?? []).filter((c) => !c.archived), [f]);
  const byId = useMemo(() => new Map((f?.courses ?? []).map((c) => [c.id, c])), [f]);
  const today = isoDay();
  const classes = useMemo(() => classesOn(new Date(), courses), [courses]);
  const next = useMemo(() => upcoming(f?.events ?? [], 14), [f]);
  const dueTasks = useMemo(() => (f?.tasks ?? []).filter((t) => !t.done && t.due && t.due <= today), [f, today]);
  const soon = next.find((e) => (e.kind === 'prova' || e.kind === 'apresentacao') && daysUntil(e.day) <= 3) ?? null;

  const doneTask = async (id: string, title: string) => {
    setF((x) => x && { ...x, tasks: x.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)) });
    const t = f?.tasks.find((x) => x.id === id);
    if (t) saveTask({ ...t, title, done: true }).catch(() => {});
  };

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="faculdade">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.replace('/exercicios/')} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.25em]"><GraduationCap size={13} /> Faculdade</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Seu semestre <span className="text-emerald-300 italic">organizado.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Matérias, provas, trabalhos e o que fazer — tudo num lugar, com lembrete antes de cada data.</p>
        </div>
        {err && !f && <p className="text-[12px] font-bold text-rose-300">{err}</p>}

        {f === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-[2rem] bg-white/[0.04] animate-pulse" />)}</div>
        ) : courses.length === 0 ? (
          <section className="p-6 rounded-[2rem] bg-gradient-to-br from-emerald-950/60 to-[#0b0f19] border border-emerald-300/20 space-y-4" data-testid="faculdade-vazio">
            <p className="text-4xl">🎓</p>
            <p className="text-lg font-black leading-snug">Comece pelas suas matérias.</p>
            <ul className="space-y-2 text-[13px] text-white/70 font-semibold">
              <li className="flex gap-2"><Check size={15} className="text-emerald-300 shrink-0 mt-0.5" /> Uma página para cada matéria, com resumos e listas</li>
              <li className="flex gap-2"><Check size={15} className="text-emerald-300 shrink-0 mt-0.5" /> Calendário de provas, trabalhos e entregas</li>
              <li className="flex gap-2"><Check size={15} className="text-emerald-300 shrink-0 mt-0.5" /> Lembrete na véspera e no dia, e a sua média</li>
            </ul>
            <button onClick={() => setCourseSheet(true)} className="w-full py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2" data-testid="add-materia"><Plus size={14} /> Adicionar matéria</button>
          </section>
        ) : (
          <>
            {/* Prova chegando: estudar e cuidar da ansiedade */}
            {soon && (
              <section className="p-5 rounded-[2rem] bg-gradient-to-br from-violet-950/60 to-[#0b0f19] border border-violet-300/25 space-y-3 card-in" data-testid="prova-chegando">
                <p className="text-[9px] font-black text-violet-300/80 uppercase tracking-[0.3em]">{kindOf(soon.kind).emoji} {countdown(soon.day)}</p>
                <p className="text-lg font-black leading-snug">{soon.title}{soon.course_id && byId.get(soon.course_id) ? ` de ${byId.get(soon.course_id)!.name}` : ''}</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => router.push('/caderno/estudar/')} className="py-3 rounded-2xl bg-violet-300 text-slate-950 text-[10px] font-black uppercase tracking-wider flex flex-col items-center gap-1"><Sparkles size={15} /> Estudar</button>
                  <button onClick={() => router.push('/caderno/foco/')} className="py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider flex flex-col items-center gap-1"><Timer size={15} /> Foco</button>
                  <button onClick={() => router.push('/respiracao/')} className="py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider flex flex-col items-center gap-1"><Wind size={15} /> Respirar</button>
                </div>
              </section>
            )}

            {/* Hoje */}
            <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3" data-testid="hoje-faculdade">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Hoje · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
              {classes.length === 0 && dueTasks.length === 0 && !next.some((e) => e.day === today) ? (
                <p className="text-[13px] text-white/60 font-semibold">Sem aulas nem entregas hoje. 🌊</p>
              ) : (
                <div className="space-y-2">
                  {classes.map((a, i) => (
                    <button key={i} onClick={() => router.push(`/faculdade/materia/?id=${a.course.id}`)} className="w-full flex items-center gap-3 text-left">
                      <span className="w-1 self-stretch rounded-full" style={{ background: colorOf(a.course).hex }} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-black truncate">{a.course.name}</span>
                        <span className="flex items-center gap-3 text-[11px] text-white/50 font-bold"><span className="flex items-center gap-1"><Clock size={11} /> {a.inicio}{a.fim ? `–${a.fim}` : ''}</span>{a.course.room && <span className="flex items-center gap-1"><MapPin size={11} /> {a.course.room}</span>}</span>
                      </span>
                    </button>
                  ))}
                  {dueTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <button onClick={() => doneTask(t.id, t.title)} className="w-5 h-5 rounded-md border-2 border-white/30 shrink-0" aria-label={`Concluir ${t.title}`} />
                      <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{t.title}</span>
                      <span className={`text-[10px] font-black uppercase ${t.due! < today ? 'text-rose-300' : 'text-amber-300'}`}>{t.due! < today ? 'atrasada' : 'hoje'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Próximas datas */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Próximas datas</p>
                <button onClick={() => setEventSheet({ event: null })} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1" data-testid="add-data"><Plus size={12} /> Data</button>
              </div>
              {next.length === 0 ? (
                <p className="text-[12px] text-white/45 font-semibold px-1">Nenhuma prova ou entrega nas próximas 2 semanas. Adicione assim que souber. 📅</p>
              ) : (
                <ul className="space-y-2" data-testid="proximas">
                  {next.slice(0, 6).map((e) => <EventRow key={e.id} e={e} course={e.course_id ? byId.get(e.course_id) ?? null : null} onClick={() => setEventSheet({ event: e })} />)}
                </ul>
              )}
              <button onClick={() => router.push('/faculdade/calendario/')} className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2" data-testid="abrir-calendario"><CalendarDays size={14} /> Ver calendário</button>
            </section>

            {/* Matérias */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Matérias</p>
                <button onClick={() => setCourseSheet(true)} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1" data-testid="add-materia"><Plus size={12} /> Matéria</button>
              </div>
              <div className="grid grid-cols-2 gap-2" data-testid="materias">
                {courses.map((c) => <CourseCard key={c.id} c={c} f={f} onClick={() => router.push(`/faculdade/materia/?id=${c.id}`)} />)}
              </div>
            </section>
          </>
        )}
      </div>

      {courseSheet && <CourseSheet course={null} open onClose={() => setCourseSheet(false)} onSaved={(c) => router.push(`/faculdade/materia/?id=${c.id}`)} />}
      {eventSheet && <EventSheet event={eventSheet.event} courses={f?.courses ?? []} open onClose={() => setEventSheet(null)} onSaved={() => setF(cachedFaculdade())} />}
    </main>
  );
}

function CourseCard({ c, f, onClick }: { c: Course; f: Faculdade; onClick: () => void }) {
  const col = colorOf(c);
  const open = f.tasks.filter((t) => t.course_id === c.id && !t.done).length;
  const nx = upcoming(f.events.filter((e) => e.course_id === c.id), 60)[0];
  const avg = average(c.id, f.events);
  return (
    <button onClick={onClick} className="p-4 rounded-[1.75rem] border text-left flex flex-col gap-2 min-h-[8.5rem] active:scale-[0.97] transition-transform" style={{ background: col.soft, borderColor: `${col.hex}40` }} data-testid="materia-card">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.hex }} />
      <span className="text-[15px] font-black leading-tight line-clamp-2">{c.name}</span>
      <span className="flex-1" />
      {nx && <span className="text-[10px] font-bold text-white/70 truncate">{kindOf(nx.kind).emoji} {nx.title} · {countdown(nx.day)}</span>}
      <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white/50">
        <span>{open ? `${open} a fazer` : 'em dia'}</span>
        {avg !== null && <span style={{ color: avg >= c.pass_grade ? '#a7f3d0' : '#fecdd3' }}>média {avg.toFixed(1).replace('.', ',')}</span>}
      </span>
    </button>
  );
}
