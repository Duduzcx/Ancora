"use client";

// Faculdade: matérias, datas importantes (provas, trabalhos, entregas) e tarefas.
// Fica na conta da pessoa (Supabase, protegido por login) e em cache no aparelho para abrir na hora.

import { createClient } from '@/lib/supabase-client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { cancelNotices, scheduleNotices } from '@/lib/reminder';

export type CourseColor = 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'teal' | 'orange' | 'indigo';
export type ClassSlot = { dia: number; inicio: string; fim: string };
export type Course = {
  id: string; name: string; color: CourseColor; professor: string | null; room: string | null;
  schedule: ClassSlot[]; page: string; pass_grade: number; archived: boolean; position: number; updated_at: string;
};
export type EventKind = 'prova' | 'trabalho' | 'entrega' | 'apresentacao' | 'outro';
export type CourseEvent = {
  id: string; course_id: string | null; kind: EventKind; title: string; day: string; at_time: string | null;
  notes: string | null; done: boolean; grade: number | null; max_grade: number; weight: number;
};
export type CourseTask = { id: string; course_id: string | null; title: string; due: string | null; done: boolean; created_at: string };
export type Faculdade = { courses: Course[]; events: CourseEvent[]; tasks: CourseTask[] };

export const COLORS: Record<CourseColor, { hex: string; soft: string; text: string }> = {
  emerald: { hex: '#34d399', soft: 'rgba(52,211,153,0.14)', text: '#a7f3d0' },
  sky: { hex: '#38bdf8', soft: 'rgba(56,189,248,0.14)', text: '#bae6fd' },
  violet: { hex: '#a78bfa', soft: 'rgba(167,139,250,0.16)', text: '#ddd6fe' },
  amber: { hex: '#fbbf24', soft: 'rgba(251,191,36,0.14)', text: '#fde68a' },
  rose: { hex: '#fb7185', soft: 'rgba(251,113,133,0.14)', text: '#fecdd3' },
  teal: { hex: '#2dd4bf', soft: 'rgba(45,212,191,0.14)', text: '#99f6e4' },
  orange: { hex: '#fb923c', soft: 'rgba(251,146,60,0.14)', text: '#fed7aa' },
  indigo: { hex: '#818cf8', soft: 'rgba(129,140,248,0.16)', text: '#c7d2fe' },
};
export const COLOR_LIST = Object.keys(COLORS) as CourseColor[];
export const colorOf = (c?: Course | null) => COLORS[c?.color ?? 'emerald'] ?? COLORS.emerald;

export const KINDS: { id: EventKind; label: string; emoji: string }[] = [
  { id: 'prova', label: 'Prova', emoji: '📝' },
  { id: 'trabalho', label: 'Trabalho', emoji: '📚' },
  { id: 'entrega', label: 'Entrega', emoji: '📦' },
  { id: 'apresentacao', label: 'Apresentação', emoji: '🎤' },
  { id: 'outro', label: 'Outro', emoji: '📌' },
];
export const kindOf = (k: EventKind) => KINDS.find((x) => x.id === k) ?? KINDS[4];
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// ---------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------

export const isoDay = (d = new Date()) => d.toLocaleDateString('en-CA');
export function daysUntil(day: string, from = isoDay()) {
  return Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);
}
export function countdown(day: string) {
  const n = daysUntil(day);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n < 0) return `há ${-n} dias`;
  if (n < 7) return `em ${n} dias`;
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
export const prettyDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

/** Aulas de um dia (pelos horários das matérias). */
export function classesOn(date: Date, courses: Course[]) {
  const dia = date.getDay();
  return courses.filter((c) => !c.archived).flatMap((c) => (c.schedule ?? []).filter((s) => s.dia === dia).map((s) => ({ course: c, ...s })))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Média da matéria (0 a 10), ponderada pelos pesos das avaliações com nota lançada. */
export function average(courseId: string, events: CourseEvent[]): number | null {
  const graded = events.filter((e) => e.course_id === courseId && e.grade !== null && e.grade !== undefined);
  if (!graded.length) return null;
  const w = graded.reduce((s, e) => s + Number(e.weight || 1), 0);
  const total = graded.reduce((s, e) => s + (Number(e.grade) / Number(e.max_grade || 10)) * 10 * Number(e.weight || 1), 0);
  return w ? Math.round((total / w) * 10) / 10 : null;
}

export function upcoming(events: CourseEvent[], days = 14) {
  const today = isoDay();
  return events.filter((e) => !e.done && e.day >= today && daysUntil(e.day) <= days)
    .sort((a, b) => (a.day + (a.at_time ?? '')).localeCompare(b.day + (b.at_time ?? '')));
}

// ---------------------------------------------------------------------
// Banco (direto no Supabase, com RLS) + cache no aparelho
// ---------------------------------------------------------------------

const uid = () => getAuthState().user?.id;
export const cachedFaculdade = () => cacheGet<Faculdade>(uid(), 'faculdade');
function remember(f: Faculdade) {
  cacheSet(uid(), 'faculdade', f);
  try { window.dispatchEvent(new Event('norica-faculdade')); } catch (_e) {}
  scheduleEventReminders(f).catch(() => {});
}

const COURSE_COLS = 'id, name, color, professor, room, schedule, page, pass_grade, archived, position, updated_at';
const EVENT_COLS = 'id, course_id, kind, title, day, at_time, notes, done, grade, max_grade, weight';
const TASK_COLS = 'id, course_id, title, due, done, created_at';

function fail(error: { message?: string } | null, msg: string) {
  if (error) throw new Error(/fetch|network|Failed/i.test(error.message ?? '') ? 'Sem internet agora. Tente de novo em instantes.' : msg);
}

export async function loadFaculdade(): Promise<Faculdade> {
  const db = createClient();
  const since = new Date(); since.setDate(since.getDate() - 200);
  const [c, e, t] = await Promise.all([
    db.from('courses').select(COURSE_COLS).order('position').order('created_at'),
    db.from('course_events').select(EVENT_COLS).gte('day', isoDay(since)).order('day').limit(500),
    db.from('course_tasks').select(TASK_COLS).order('created_at').limit(500),
  ]);
  fail(c.error || e.error || t.error, 'Não foi possível carregar a Faculdade agora.');
  const f = {
    courses: (c.data ?? []).map((x) => ({ ...x, schedule: Array.isArray(x.schedule) ? x.schedule : [], pass_grade: Number(x.pass_grade) })) as Course[],
    events: (e.data ?? []).map((x) => ({ ...x, grade: x.grade === null ? null : Number(x.grade), max_grade: Number(x.max_grade), weight: Number(x.weight) })) as CourseEvent[],
    tasks: (t.data ?? []) as CourseTask[],
  };
  remember(f);
  return f;
}

function patchCache(fn: (f: Faculdade) => Faculdade) {
  const cur = cachedFaculdade() ?? { courses: [], events: [], tasks: [] };
  remember(fn(cur));
}

export async function saveCourse(c: Partial<Course> & { name: string }): Promise<Course> {
  const db = createClient();
  const row = {
    name: c.name.trim().slice(0, 60), color: c.color ?? 'emerald', professor: c.professor?.trim() || null, room: c.room?.trim() || null,
    schedule: c.schedule ?? [], pass_grade: c.pass_grade ?? 6, archived: c.archived ?? false, updated_at: new Date().toISOString(),
    ...(c.page !== undefined ? { page: c.page } : {}), ...(c.position !== undefined ? { position: c.position } : {}),
  };
  const q = c.id ? db.from('courses').update(row).eq('id', c.id) : db.from('courses').insert(row);
  const { data, error } = await q.select(COURSE_COLS).single();
  fail(error, 'Não foi possível salvar a matéria.');
  const saved = { ...data, schedule: Array.isArray(data!.schedule) ? data!.schedule : [], pass_grade: Number(data!.pass_grade) } as Course;
  patchCache((f) => ({ ...f, courses: c.id ? f.courses.map((x) => (x.id === saved.id ? saved : x)) : [...f.courses, saved] }));
  return saved;
}

export async function savePage(id: string, page: string) {
  const { error } = await createClient().from('courses').update({ page: page.slice(0, 20000), updated_at: new Date().toISOString() }).eq('id', id);
  fail(error, 'Não foi possível salvar a página.');
  patchCache((f) => ({ ...f, courses: f.courses.map((x) => (x.id === id ? { ...x, page } : x)) }));
}

export async function deleteCourse(id: string) {
  const { error } = await createClient().from('courses').delete().eq('id', id);
  fail(error, 'Não foi possível apagar a matéria.');
  patchCache((f) => ({ courses: f.courses.filter((x) => x.id !== id), events: f.events.filter((x) => x.course_id !== id), tasks: f.tasks.filter((x) => x.course_id !== id) }));
}

export async function saveEvent(e: Partial<CourseEvent> & { title: string; day: string }): Promise<CourseEvent> {
  const db = createClient();
  const row = {
    course_id: e.course_id ?? null, kind: e.kind ?? 'prova', title: e.title.trim().slice(0, 80), day: e.day, at_time: e.at_time || null,
    notes: e.notes?.trim() || null, done: e.done ?? false, grade: e.grade ?? null, max_grade: e.max_grade ?? 10, weight: e.weight ?? 1,
  };
  const q = e.id ? db.from('course_events').update(row).eq('id', e.id) : db.from('course_events').insert(row);
  const { data, error } = await q.select(EVENT_COLS).single();
  fail(error, 'Não foi possível salvar a data.');
  const saved = { ...data, grade: data!.grade === null ? null : Number(data!.grade), max_grade: Number(data!.max_grade), weight: Number(data!.weight) } as CourseEvent;
  patchCache((f) => ({ ...f, events: e.id ? f.events.map((x) => (x.id === saved.id ? saved : x)) : [...f.events, saved] }));
  return saved;
}

export async function deleteEvent(id: string) {
  const { error } = await createClient().from('course_events').delete().eq('id', id);
  fail(error, 'Não foi possível apagar a data.');
  patchCache((f) => ({ ...f, events: f.events.filter((x) => x.id !== id) }));
}

export async function saveTask(t: Partial<CourseTask> & { title: string }): Promise<CourseTask> {
  const db = createClient();
  const row = { course_id: t.course_id ?? null, title: t.title.trim().slice(0, 140), due: t.due || null, done: t.done ?? false, done_at: t.done ? new Date().toISOString() : null };
  const q = t.id ? db.from('course_tasks').update(row).eq('id', t.id) : db.from('course_tasks').insert(row);
  const { data, error } = await q.select(TASK_COLS).single();
  fail(error, 'Não foi possível salvar a tarefa.');
  const saved = data as CourseTask;
  patchCache((f) => ({ ...f, tasks: t.id ? f.tasks.map((x) => (x.id === saved.id ? saved : x)) : [...f.tasks, saved] }));
  return saved;
}

export async function deleteTask(id: string) {
  const { error } = await createClient().from('course_tasks').delete().eq('id', id);
  fail(error, 'Não foi possível apagar a tarefa.');
  patchCache((f) => ({ ...f, tasks: f.tasks.filter((x) => x.id !== id) }));
}

// ---------------------------------------------------------------------
// Lembretes: véspera (19h) e manhã do dia (7h) de cada prova/trabalho dos próximos 30 dias
// ---------------------------------------------------------------------

const REMINDER_IDS = Array.from({ length: 40 }, (_, i) => 7600 + i);
export async function scheduleEventReminders(f: Faculdade) {
  await cancelNotices(REMINDER_IDS).catch(() => {});
  const byId = new Map(f.courses.map((c) => [c.id, c]));
  const list = upcoming(f.events, 30).slice(0, 20).flatMap((e, i) => {
    const k = kindOf(e.kind); const c = e.course_id ? byId.get(e.course_id) : null;
    const name = `${k.label}${c ? ` de ${c.name}` : ''}`;
    const eve = new Date(`${e.day}T19:00:00`); eve.setDate(eve.getDate() - 1);
    const morning = new Date(`${e.day}T07:00:00`);
    const what = e.title.toLowerCase() === k.label.toLowerCase() ? name : `${name}: ${e.title}`;
    return [
      { id: REMINDER_IDS[i * 2], at: eve, route: '/faculdade/', title: `Amanhã: ${what} ${k.emoji}`, body: e.kind === 'prova' ? 'Revise os pontos-chave e durma cedo. Se bater ansiedade, respira com a Nórica. 💙' : 'Dá uma conferida para não deixar para a última hora.' },
      { id: REMINDER_IDS[i * 2 + 1], at: morning, route: '/faculdade/', title: `Hoje: ${what}${e.at_time ? ` às ${hhmm(e.at_time)}` : ''} ${k.emoji}`, body: e.kind === 'prova' ? 'Você se preparou. Respira fundo e vai com calma. Boa prova! 🍀' : 'Hoje é o dia. Você consegue!' },
    ];
  });
  if (list.length) await scheduleNotices(list);
}

// ---------------------------------------------------------------------
// Página da matéria (estilo Notion, simples): # título, ## subtítulo, - lista, [ ] tarefa
// ---------------------------------------------------------------------

export type Block = { type: 'h1' | 'h2' | 'li' | 'todo' | 'p' | 'gap'; text: string; checked?: boolean; line: number };
export function parsePage(page: string): Block[] {
  return page.split('\n').map((raw, line) => {
    const l = raw.trimEnd();
    if (!l.trim()) return { type: 'gap', text: '', line };
    let m;
    if ((m = l.match(/^\s*\[( |x|X)\]\s?(.*)$/))) return { type: 'todo', text: m[2], checked: m[1].toLowerCase() === 'x', line };
    if ((m = l.match(/^##\s+(.*)$/))) return { type: 'h2', text: m[1], line };
    if ((m = l.match(/^#\s+(.*)$/))) return { type: 'h1', text: m[1], line };
    if ((m = l.match(/^\s*[-•*](?:\s+(.*))?$/))) return { type: 'li', text: m[1] ?? '', line };
    return { type: 'p', text: l, line };
  });
}
export function toggleTodo(page: string, line: number) {
  const lines = page.split('\n');
  lines[line] = lines[line].replace(/\[( |x|X)\]/, (_m, c) => (c === ' ' ? '[x]' : '[ ]'));
  return lines.join('\n');
}
export const PAGE_TEMPLATES: { label: string; text: string }[] = [
  { label: 'Resumo de aula', text: `# Aula de ${new Date().toLocaleDateString('pt-BR')}\n## O que foi visto\n- \n## Dúvidas para perguntar\n- \n## Para fazer\n[ ] ` },
  { label: 'Ementa e critérios', text: '# Sobre a matéria\n## Como é a avaliação\n- P1: \n- P2: \n- Trabalho: \n## Conteúdo do semestre\n- ' },
  { label: 'Revisão para a prova', text: '# Revisão para a prova\n## O que cai\n[ ] \n[ ] \n## Fórmulas e conceitos\n- \n## Exercícios para refazer\n[ ] ' },
];
