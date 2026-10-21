"use client";

// Calendário da Faculdade: o mês com as provas, trabalhos e entregas marcados com a cor da matéria.

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, CalendarDays, Clock } from 'lucide-react';
import { cachedFaculdade, classesOn, colorOf, isoDay, loadFaculdade, type CourseEvent, type Faculdade } from '@/lib/faculdade';
import { EventSheet } from '@/components/faculdade/Sheets';
import EventRow from '@/components/faculdade/EventRow';

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function CalendarioPage() {
  const router = useRouter();
  const [f, setF] = useState<Faculdade | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(isoDay());
  const [sheet, setSheet] = useState<{ event: CourseEvent | null } | null>(null);

  useEffect(() => {
    setF(cachedFaculdade());
    loadFaculdade().then(setF).catch(() => {});
    const on = () => setF(cachedFaculdade());
    window.addEventListener('norica-faculdade', on);
    return () => window.removeEventListener('norica-faculdade', on);
  }, []);

  const byId = useMemo(() => new Map((f?.courses ?? []).map((c) => [c.id, c])), [f]);
  const byDay = useMemo(() => {
    const m = new Map<string, CourseEvent[]>();
    for (const e of f?.events ?? []) m.set(e.day, [...(m.get(e.day) ?? []), e]);
    return m;
  }, [f]);

  const cells = useMemo(() => {
    const first = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const today = isoDay();
  const selDate = new Date(`${sel}T12:00:00`);
  const selEvents = (byDay.get(sel) ?? []).sort((a, b) => (a.at_time ?? '').localeCompare(b.at_time ?? ''));
  const selClasses = classesOn(selDate, f?.courses ?? []);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthEvents = (f?.events ?? []).filter((e) => e.day.startsWith(monthKey)).sort((a, b) => a.day.localeCompare(b.day));
  const go = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="calendario">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/faculdade/')} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.25em]"><CalendarDays size={12} /> Calendário</span>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter leading-none" data-testid="mes">
            <span className="capitalize">{month.toLocaleDateString('pt-BR', { month: 'long' })}</span>
            <span className="block text-base text-white/40 tracking-tight">{month.getFullYear()}</span>
          </h1>
          <div className="flex gap-1.5">
            <button onClick={() => go(-1)} className="p-2.5 rounded-full bg-white/5 border border-white/10" aria-label="Mês anterior"><ChevronLeft size={16} /></button>
            <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(today); }} className="px-3 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Hoje</button>
            <button onClick={() => go(1)} className="p-2.5 rounded-full bg-white/5 border border-white/10" aria-label="Próximo mês"><ChevronRight size={16} /></button>
          </div>
        </div>

        <section className="p-3 rounded-[2rem] bg-white/5 border border-white/10">
          <div className="grid grid-cols-7 mb-1">{WD.map((d, i) => <span key={i} className="text-center text-[10px] font-black text-white/35 py-1">{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1" data-testid="grade-mes">
            {cells.map((d, i) => {
              if (!d) return <span key={`v${i}`} />;
              const k = isoDay(d); const ev = byDay.get(k) ?? []; const isSel = k === sel; const isToday = k === today;
              return (
                <button key={k} onClick={() => setSel(k)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 ${isSel ? 'bg-white/15' : ''}`} aria-label={`Dia ${d.getDate()}${ev.length ? `, ${ev.length} ${ev.length === 1 ? 'data' : 'datas'}` : ''}`} data-testid={`dia-${k}`}>
                  <span className={`text-[13px] font-black w-7 h-7 rounded-full flex items-center justify-center ${isToday ? 'bg-emerald-400 text-slate-950' : ev.length ? 'text-white' : 'text-white/55'}`}>{d.getDate()}</span>
                  <span className="flex gap-0.5 h-1.5">
                    {ev.slice(0, 3).map((e) => <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: colorOf(e.course_id ? byId.get(e.course_id) : null).hex, opacity: e.done ? 0.4 : 1 }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2" data-testid="dia-selecionado">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{selDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
            <button onClick={() => setSheet({ event: null })} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1" data-testid="add-data-dia"><Plus size={12} /> Data</button>
          </div>
          {selClasses.map((a, i) => (
            <button key={i} onClick={() => router.push(`/faculdade/materia/?id=${a.course.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.03] text-left">
              <span className="w-1 self-stretch rounded-full" style={{ background: colorOf(a.course).hex }} />
              <span className="flex-1 text-[13px] font-bold">Aula de {a.course.name}</span>
              <span className="text-[11px] text-white/45 font-bold flex items-center gap-1"><Clock size={11} /> {a.inicio}</span>
            </button>
          ))}
          {selEvents.length === 0 && selClasses.length === 0 && <p className="text-[12px] text-white/40 font-semibold px-1">Nada marcado neste dia.</p>}
          <ul className="space-y-2">{selEvents.map((e) => <EventRow key={e.id} e={e} course={e.course_id ? byId.get(e.course_id) ?? null : null} onClick={() => setSheet({ event: e })} />)}</ul>
        </section>

        {monthEvents.length > 0 && (
          <section className="space-y-2">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest px-1">Todas do mês ({monthEvents.length})</p>
            <ul className="space-y-2">{monthEvents.map((e) => <EventRow key={e.id} e={e} course={e.course_id ? byId.get(e.course_id) ?? null : null} onClick={() => setSheet({ event: e })} />)}</ul>
          </section>
        )}
      </div>
      {sheet && <EventSheet event={sheet.event} courses={f?.courses ?? []} defaultDay={sel} open onClose={() => setSheet(null)} onSaved={() => setF(cachedFaculdade())} />}
    </main>
  );
}
