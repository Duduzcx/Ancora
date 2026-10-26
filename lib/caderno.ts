"use client";

// Caderno (estudos e ideias): rótulos, resumo em cache, gravação por voz e lembrete de revisão.

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Lightbulb, BellRing } from 'lucide-react';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { noricaApi, type NoteKind, type StudyNote, type StudySummary } from '@/lib/norica-api';
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
