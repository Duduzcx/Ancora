"use client";

// Caderno (estudos e ideias): rótulos, resumo em cache, gravação por voz e lembrete de revisão.

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Lightbulb, BellRing } from 'lucide-react';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { noricaApi, type NoteKind, type StudyNote, type StudyPlan, type StudySummary } from '@/lib/norica-api';
import { cancelNotices, scheduleNotices } from '@/lib/reminder';

export const KINDS: { id: NoteKind; label: string; short: string; icon: any; cls: string; dot: string; hint: string }[] = [
  { id: 'aprendizado', label: 'Aprendi', short: 'Aprendizado', icon: BookOpen, cls: 'bg-emerald-400/15 border-emerald-300/40 text-emerald-100', dot: '#34d399', hint: 'Ex.: Na fotossíntese a planta usa luz, água e gás carbônico para fazer glicose.' },
  { id: 'ideia', label: 'Tive uma ideia', short: 'Ideia', icon: Lightbulb, cls: 'bg-amber-400/15 border-amber-300/40 text-amber-100', dot: '#fbbf24', hint: 'Ex.: Fazer um grupo de estudos às quartas com a Ana e o Lucas.' },
  { id: 'lembrete', label: 'Não posso esquecer', short: 'Lembrete', icon: BellRing, cls: 'bg-sky-400/15 border-sky-300/40 text-sky-100', dot: '#38bdf8', hint: 'Ex.: Entregar o trabalho de história na sexta e levar o livro.' },
];
export const kindInfo = (k: NoteKind) => KINDS.find((x) => x.id === k) ?? KINDS[0];

// ---------------------------------------------------------------------
// Resumo do Caderno (cartões para hoje etc.) — aparece na hora a partir do cache
// ---------------------------------------------------------------------

const uid = () => getAuthState().user?.id;
export const cachedStudy = () => cacheGet<StudySummary>(uid(), 'study');
export function rememberStudy(s: StudySummary) {
  cacheSet(uid(), 'study', s);
  try { window.dispatchEvent(new Event('norica-caderno')); } catch (_e) {}
  scheduleReviewReminders(s).catch(() => {});
}
// Lista do Caderno guardada no aparelho para abrir na hora (sem os cartões e com o texto encurtado).
export const cachedNotes = () => cacheGet<{ notes: StudyNote[]; subjects: string[] }>(uid(), 'caderno-notas');
export function rememberNotes(notes: StudyNote[], subjects: string[]) {
  const lean = notes.slice(0, 150).map(({ cardList: _c, content, ...n }) => ({ ...n, content: content.slice(0, 400) }));
  cacheSet(uid(), 'caderno-notas', { notes: lean, subjects });
}

export async function refreshStudy(): Promise<StudySummary | null> {
  try { const s = await noricaApi.studySummary(); rememberStudy(s); return s; } catch (_e) { return null; }
}

// ---------------------------------------------------------------------
// Lembrete diário de revisão (só se a pessoa ligar; usa a permissão de notificação já dada)
// ---------------------------------------------------------------------

const PREF = 'norica-caderno-lembrete';
const IDS = [7501, 7502, 7503, 7504, 7505, 7506, 7507];
export type ReviewReminder = { on: boolean; hour: number };
export function getReviewReminder(): ReviewReminder {
  try { return { on: false, hour: 19, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch (_e) { return { on: false, hour: 19 }; }
}
export async function setReviewReminder(r: ReviewReminder): Promise<boolean> {
  try { localStorage.setItem(PREF, JSON.stringify(r)); } catch (_e) {}
  if (!r.on) { await cancelNotices(IDS).catch(() => {}); return true; }
  return scheduleReviewReminders(cachedStudy(), true);
}
async function scheduleReviewReminders(s: StudySummary | null, force = false): Promise<boolean> {
  const r = getReviewReminder();
  if (!r.on || (!force && !s)) return false;
  const list = IDS.map((id, i) => {
    const at = new Date(); at.setDate(at.getDate() + i); at.setHours(r.hour, 0, 0, 0);
    const today = i === 0 && s?.due;
    return {
      id, at, route: '/caderno/revisar/',
      title: today ? `${s!.due} ${s!.due === 1 ? 'cartão' : 'cartões'} para relembrar 📒` : 'Hora de relembrar 📒',
      body: today ? 'Leva 2 minutos e ajuda a memória a guardar de vez.' : 'Uma revisão rapidinha hoje ajuda você a não esquecer o que estudou.',
    };
  });
  return scheduleNotices(list);
}

// ---------------------------------------------------------------------
// Gravar por voz e virar texto (até 2 minutos)
// ---------------------------------------------------------------------

export function useVoiceNote(onText: (t: string) => void, maxSeconds = 120) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  };
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => { if (state === 'recording' && seconds >= maxSeconds) stop(); }, [seconds, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('processing');
        try {
          const text = await noricaApi.transcribe(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }));
          if (!text.trim()) throw new Error('Não consegui ouvir. Tente falar mais perto do celular.');
          onText(text.trim());
        } catch (e: any) {
          setError(e?.message || 'Não foi possível transcrever o áudio.');
        } finally {
          setState('idle');
        }
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      setState('recording');
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (_e) {
      setError('Não consegui acessar o microfone. Libere a permissão nas configurações do celular ou escreva.');
    }
  };
  return { state, seconds, error, start, stop };
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return `${diff} dias atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------
// Plano de estudos: dia de hoje e lembrete diário
// ---------------------------------------------------------------------

/** Qual dia do plano é hoje (1 = dia em que começou), limitado ao total de dias. */
export function planToday(p: StudyPlan) {
  const start = new Date(`${p.startsOn}T12:00:00`);
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const n = Math.round((now.getTime() - start.getTime()) / 86400000) + 1;
  return Math.min(Math.max(n, 1), p.totalDays);
}
/** Próximo dia a fazer: o primeiro ainda não marcado. */
export const planNext = (p: StudyPlan) => p.dias.find((d) => !p.doneDays.includes(d.dia)) ?? null;

const PLAN_PREF = 'norica-plano-lembrete';
const PLAN_IDS = [7701, 7702, 7703, 7704, 7705, 7706, 7707];
export function getPlanReminder(): { planId: string | null; hour: number } {
  try { return { planId: null, hour: 18, ...JSON.parse(localStorage.getItem(PLAN_PREF) || '{}') }; } catch (_e) { return { planId: null, hour: 18 }; }
}
export async function setPlanReminder(p: StudyPlan | null, hour = 18): Promise<boolean> {
  try { localStorage.setItem(PLAN_PREF, JSON.stringify({ planId: p?.id ?? null, hour })); } catch (_e) {}
  await cancelNotices(PLAN_IDS).catch(() => {});
  if (!p) return true;
  const today = planToday(p);
  const list = PLAN_IDS.map((id, i) => {
    const d = p.dias.find((x) => x.dia === today + i);
    if (!d) return null;
    const at = new Date(); at.setDate(at.getDate() + i); at.setHours(hour, 0, 0, 0);
    return { id, at, route: `/caderno/plano/?id=${p.id}`, title: `Dia ${d.dia} do seu plano 📚`, body: `${d.titulo} — ${p.minutes} minutinhos hoje. Você consegue!` };
  }).filter(Boolean) as { id: number; at: Date; route: string; title: string; body: string }[];
  return scheduleNotices(list);
}

// Resumo dos planos guardado no aparelho (card "Dia N do seu plano" na Início).
export type PlanBrief = { id: string; titulo: string; next: { dia: number; titulo: string } | null; done: number; total: number };
export const cachedPlans = () => cacheGet<PlanBrief[]>(uid(), 'planos') ?? [];
export function rememberPlans(plans: StudyPlan[]) {
  const brief = plans.map((p) => { const n = planNext(p); return { id: p.id, titulo: p.titulo, next: n ? { dia: n.dia, titulo: n.titulo } : null, done: p.doneDays.length, total: p.totalDays }; });
  cacheSet(uid(), 'planos', brief);
  try { window.dispatchEvent(new Event('norica-planos')); } catch (_e) {}
}
