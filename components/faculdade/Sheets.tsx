"use client";

// Folhas de baixo da Faculdade: criar/editar matéria e criar/editar data (prova, trabalho...).

import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  COLORS, COLOR_LIST, KINDS, WEEKDAYS, isoDay, saveCourse, saveEvent, deleteEvent,
  type ClassSlot, type Course, type CourseColor, type CourseEvent, type EventKind,
} from '@/lib/faculdade';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Fechar" />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#06191d] border-t border-white/10 rounded-t-[2rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] space-y-5 card-in text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-white/60" aria-label="Fechar"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const label = 'block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5';
const input = 'w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-300/40 placeholder:text-white/25';

export function CourseSheet({ course, open, onClose, onSaved }: { course: Course | null; open: boolean; onClose: () => void; onSaved: (c: Course) => void }) {
  const [name, setName] = useState(course?.name ?? '');
  const [color, setColor] = useState<CourseColor>(course?.color ?? 'emerald');
  const [professor, setProfessor] = useState(course?.professor ?? '');
  const [room, setRoom] = useState(course?.room ?? '');
  const [slots, setSlots] = useState<ClassSlot[]>(course?.schedule ?? []);
  const [pass, setPass] = useState(String(course?.pass_grade ?? 6));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setErr('Dê um nome para a matéria.'); return; }
    setBusy(true); setErr(null);
    try {
      const c = await saveCourse({ ...(course ?? {}), name, color, professor, room, schedule: slots.filter((s) => s.inicio), pass_grade: Math.min(100, Math.max(0, Number(pass.replace(',', '.')) || 6)) });
      onSaved(c); onClose();
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={course ? 'Editar matéria' : 'Nova matéria'}>
      <div>
        <span className={label}>Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Cálculo I" className={input} data-testid="materia-nome" autoFocus={!course} />
      </div>
      <div>
        <span className={label}>Cor</span>
        <div className="flex gap-2 flex-wrap">
          {COLOR_LIST.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className="w-9 h-9 rounded-full border-2" style={{ background: COLORS[c].hex, borderColor: color === c ? '#fff' : 'transparent' }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><span className={label}>Professor(a)</span><input value={professor} onChange={(e) => setProfessor(e.target.value)} maxLength={60} placeholder="Opcional" className={input} /></div>
        <div><span className={label}>Sala</span><input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={40} placeholder="Ex.: 204" className={input} /></div>
      </div>
      <div>
        <span className={label}>Horários das aulas</span>
        <div className="space-y-2">
          {slots.map((s, i) => (
            <div key={i} className="flex gap-1.5 items-center" data-testid="horario">
              <select value={s.dia} onChange={(e) => setSlots((l) => l.map((x, j) => (j === i ? { ...x, dia: Number(e.target.value) } : x)))} className="bg-black/30 border border-white/10 rounded-xl px-2 py-2.5 text-sm">
                {WEEKDAYS.map((d, k) => <option key={d} value={k} className="bg-[#06191d]">{d}</option>)}
              </select>
              <input type="time" value={s.inicio} onChange={(e) => setSlots((l) => l.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-2 py-2 text-sm [color-scheme:dark]" aria-label="Início" />
              <input type="time" value={s.fim} onChange={(e) => setSlots((l) => l.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-2 py-2 text-sm [color-scheme:dark]" aria-label="Fim" />
              <button onClick={() => setSlots((l) => l.filter((_, j) => j !== i))} className="p-2 text-white/40" aria-label="Tirar horário"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => setSlots((l) => [...l, { dia: l.length ? l[l.length - 1].dia : 1, inicio: '19:00', fim: '20:40' }])} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1" data-testid="add-horario"><Plus size={12} /> Adicionar horário</button>
        </div>
      </div>
      <div className="w-1/2">
        <span className={label}>Média para passar</span>
        <input value={pass} onChange={(e) => setPass(e.target.value)} inputMode="decimal" className={input} />
      </div>
      {err && <p className="text-[12px] font-bold text-rose-300">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50" data-testid="materia-salvar">
        {busy && <Loader2 size={14} className="animate-spin" />} Salvar matéria
      </button>
    </Sheet>
  );
}

export function EventSheet({ event, courses, defaultCourse, defaultDay, open, onClose, onSaved }: {
  event: CourseEvent | null; courses: Course[]; defaultCourse?: string | null; defaultDay?: string;
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'prova');
  const [title, setTitle] = useState(event?.title ?? '');
  const [courseId, setCourseId] = useState<string>(event?.course_id ?? defaultCourse ?? courses[0]?.id ?? '');
  const [day, setDay] = useState(event?.day ?? defaultDay ?? isoDay());
  const [time, setTime] = useState(event?.at_time?.slice(0, 5) ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [grade, setGrade] = useState(event?.grade != null ? String(event.grade) : '');
  const [max, setMax] = useState(String(event?.max_grade ?? 10));
  const [weight, setWeight] = useState(String(event?.weight ?? 1));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const num = (s: string) => Number(s.replace(',', '.'));
  const past = day <= isoDay();

  const save = async () => {
    const t = title.trim() || KINDS.find((k) => k.id === kind)!.label;
    if (!day) { setErr('Escolha a data.'); return; }
    if (grade && (!Number.isFinite(num(grade)) || num(grade) < 0 || num(grade) > num(max))) { setErr(`A nota precisa ser entre 0 e ${max}.`); return; }
    setBusy(true); setErr(null);
    try {
      await saveEvent({ ...(event ?? {}), kind, title: t, course_id: courseId || null, day, at_time: time || null, notes, grade: grade ? num(grade) : null, max_grade: num(max) || 10, weight: num(weight) || 1, done: grade ? true : event?.done ?? false });
      onSaved(); onClose();
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!event || !window.confirm('Apagar esta data?')) return;
    setBusy(true);
    try { await deleteEvent(event.id); onSaved(); onClose(); } catch (e: any) { setErr(e?.message || 'Não foi possível apagar.'); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={event ? 'Editar data' : 'Nova data importante'}>
      <div className="flex gap-1.5 flex-wrap">
        {KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className={`px-3 py-2 rounded-xl border text-[12px] font-black ${kind === k.id ? 'bg-white/15 border-white/30' : 'bg-white/[0.03] border-white/10 text-white/55'}`}>{k.emoji} {k.label}</button>
        ))}
      </div>
      <div>
        <span className={label}>Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={kind === 'prova' ? 'Ex.: P1' : kind === 'trabalho' ? 'Ex.: Trabalho em grupo' : 'Ex.: Relatório do laboratório'} className={input} data-testid="data-titulo" />
      </div>
      {courses.length > 0 && (
        <div>
          <span className={label}>Matéria</span>
          <div className="flex gap-1.5 flex-wrap">
            {courses.filter((c) => !c.archived).map((c) => (
              <button key={c.id} onClick={() => setCourseId(c.id)} aria-pressed={courseId === c.id} className="px-3 py-2 rounded-xl border text-[12px] font-bold flex items-center gap-1.5"
                style={courseId === c.id ? { background: COLORS[c.color].soft, borderColor: COLORS[c.color].hex, color: COLORS[c.color].text } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[c.color].hex }} /> {c.name}
              </button>
            ))}
            <button onClick={() => setCourseId('')} aria-pressed={!courseId} className={`px-3 py-2 rounded-xl border text-[12px] font-bold ${!courseId ? 'bg-white/15 border-white/30' : 'border-white/10 text-white/55'}`}>Geral</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><span className={label}>Dia</span><input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${input} [color-scheme:dark]`} data-testid="data-dia" /></div>
        <div><span className={label}>Hora (opcional)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} [color-scheme:dark]`} /></div>
      </div>
      <div>
        <span className={label}>Anotações</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Ex.: cai capítulos 1 a 4, pode usar calculadora" className={`${input} resize-none`} />
      </div>
      {(kind === 'prova' || kind === 'trabalho' || kind === 'apresentacao' || event) && (
        <div className={`p-4 rounded-2xl border space-y-2 ${past ? 'bg-white/[0.04] border-white/10' : 'border-dashed border-white/10'}`}>
          <span className={label}>Nota {past ? '' : '(quando sair)'}</span>
          <div className="grid grid-cols-3 gap-2">
            <input value={grade} onChange={(e) => setGrade(e.target.value)} inputMode="decimal" placeholder="Nota" className={input} data-testid="data-nota" aria-label="Nota" />
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" className={input} aria-label="Valendo" />
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={input} aria-label="Peso" />
          </div>
          <p className="text-[10px] text-white/40 font-semibold">Nota · valendo · peso na média</p>
        </div>
      )}
      {err && <p className="text-[12px] font-bold text-rose-300">{err}</p>}
      <div className="flex gap-2">
        {event && <button onClick={remove} disabled={busy} className="px-4 rounded-2xl bg-rose-500/10 border border-rose-400/20 text-rose-200" aria-label="Apagar data"><Trash2 size={16} /></button>}
        <button onClick={save} disabled={busy} className="flex-1 py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50" data-testid="data-salvar">
          {busy && <Loader2 size={14} className="animate-spin" />} Salvar data
        </button>
      </div>
    </Sheet>
  );
}
