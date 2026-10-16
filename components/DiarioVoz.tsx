"use client";

// Diário por voz: a pessoa fala até 1 minuto (ou escreve) e a Nórica transforma em
// registro do dia — resumo, humor e, se fizer sentido, um passo pequeno para os Logs.

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, PenLine, Plus, CheckCircle2, Trash2, ChevronDown, BookHeart } from 'lucide-react';
import { noricaApi, type JournalEntry } from '@/lib/norica-api';
import { HelpSheet } from '@/components/AjudaAgora';

const MAX_SECONDS = 60;
const MOOD_LABEL: Record<string, { label: string; cls: string }> = {
  calmo: { label: 'Calmo', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  ansioso: { label: 'Ansioso', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  agitado: { label: 'Agitado', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  sos: { label: 'Dia difícil', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
};

export default function DiarioVoz({ onAddTasks }: { onAddTasks: (tasks: string[]) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'writing' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ entry: JournalEntry; tasks: string[] } | null>(null);
  const [tasksAdded, setTasksAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    noricaApi.journalList(5, 'voz').then((r) => setHistory(r.entries)).catch(() => {});
    return () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const process = async (spoken: string) => {
    setState('processing');
    setError(null);
    try {
      const r = await noricaApi.journalVoice(spoken);
      setResult({ entry: r.entry, tasks: r.tasks });
      setTasksAdded(false);
      setHistory((h) => [r.entry, ...h].slice(0, 5));
      setText('');
      if (r.crisis) setHelpOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar agora.');
    } finally {
      setState('idle');
    }
  };

  const start = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        setState('processing');
        try {
          const spoken = await noricaApi.transcribe(blob);
          if (!spoken.trim()) throw new Error('Não consegui ouvir. Tente falar mais perto do celular.');
          await process(spoken);
        } catch (err: any) {
          setError(err?.message || 'Não foi possível transcrever o áudio.');
          setState('idle');
        }
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setState('recording');
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (_e) {
      setError('Não consegui acessar o microfone. Libere a permissão nas configurações do celular ou escreva.');
    }
  };

  // Para sozinho em 1 minuto.
  useEffect(() => {
    if (state === 'recording' && seconds >= MAX_SECONDS) stop();
  }, [seconds, state]);

  const stop = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  };

  const remove = async (id: string) => {
    setHistory((h) => h.filter((e) => e.id !== id));
    if (result?.entry.id === id) setResult(null);
    noricaApi.journalDelete(id).catch(() => {});
  };

  const mood = result?.entry.mood ? MOOD_LABEL[result.entry.mood] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4 relative overflow-hidden"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 rounded-2xl">
          <BookHeart size={18} />
        </div>
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">Diário por voz</h3>
          <p className="text-[9px] font-black text-teal-300 uppercase tracking-widest">Fale até 1 minuto sobre o seu dia</p>
        </div>
      </div>

      {state === 'recording' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={stop}
            className="w-20 h-20 rounded-full bg-rose-500 text-white flex items-center justify-center relative"
            aria-label="Parar gravação"
          >
            <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping" />
            <Square size={26} className="relative" />
          </motion.button>
          <p className="text-sm font-black text-white tabular-nums">0:{String(seconds).padStart(2, '0')} <span className="text-white/40">/ 1:00</span></p>
          <p className="text-[11px] text-white/50 font-semibold">Toque para terminar</p>
        </div>
      )}

      {state === 'processing' && (
        <div className="flex items-center justify-center gap-3 text-white/60 text-sm font-bold py-6">
          <Loader2 size={18} className="animate-spin" /> A Nórica está registrando seu dia…
        </div>
      )}

      {state === 'writing' && (
        <div className="space-y-3">
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Como foi seu dia? O que pesou, o que foi bom…"
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-teal-500/50 placeholder:text-white/25"
          />
          <div className="flex gap-2">
            <button onClick={() => text.trim() && process(text.trim())} disabled={!text.trim()} className="flex-1 py-3 rounded-2xl bg-teal-500 text-slate-950 font-black uppercase tracking-widest text-[10px] disabled:opacity-40">
              Registrar
            </button>
            <button onClick={() => setState('idle')} className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={start}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-200 font-black uppercase tracking-widest text-[10px]"
          >
            <Mic size={16} /> Gravar meu dia
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setResult(null); setState('writing'); }}
            className="px-5 flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px]"
            aria-label="Escrever em vez de falar"
          >
            <PenLine size={15} /> Escrever
          </motion.button>
        </div>
      )}

      {error && <p className="text-xs font-bold text-rose-300">{error}</p>}

      <AnimatePresence>
        {result && state === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-white">{result.entry.title || 'Registro de hoje'}</p>
              {mood && <span className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${mood.cls}`}>{mood.label}</span>}
            </div>
            <p className="text-sm text-white/75 font-semibold leading-relaxed">{result.entry.summary}</p>
            {result.tasks.length > 0 && (
              tasksAdded ? (
                <p className="flex items-center gap-2 text-teal-300 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14} /> Adicionado aos seus Logs</p>
              ) : (
                <button
                  onClick={() => { onAddTasks(result.tasks); setTasksAdded(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-black uppercase tracking-widest"
                >
                  <Plus size={14} /> {result.tasks.length === 1 ? `Adicionar "${result.tasks[0]}"` : `Adicionar ${result.tasks.length} passos`}
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1 text-[10px] font-black text-white/40 uppercase tracking-widest">
            Diários anteriores <ChevronDown size={14} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <ul className="mt-3 space-y-2">
              {history.map((e) => (
                <li key={e.id} className="flex items-start gap-3 p-3 rounded-2xl bg-black/20 border border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                      {new Date(e.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-xs text-white/70 font-semibold leading-relaxed mt-1">{e.summary}</p>
                  </div>
                  <button onClick={() => remove(e.id)} className="p-2 text-white/30" aria-label="Apagar este diário"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </motion.div>
  );
}
