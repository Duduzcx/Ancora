"use client";

// "Hoje em 1 minuto": humor, um cuidado e uma frase no diário — numa tela só.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, Check, Loader2, Timer, Droplets, Wind, MapPin, MessageCircle, Apple, StretchHorizontal, Moon, Sun, Phone } from 'lucide-react';
import { logMood, markHabitsToday, noricaApi, type Mood } from '@/lib/norica-api';
import { FEELINGS } from '@/components/RodaEmocoes';
import { MOOD_COLOR, MOOD_LABEL } from '@/lib/farol';
import { HelpSheet } from '@/components/AjudaAgora';
import { usePhase } from '@/lib/fase';

const MOODS: Mood[] = ['calmo', 'ansioso', 'agitado', 'sos'];
const CARES: { id: number; label: string; icon: any }[] = [
  { id: 1, label: 'Bebi água', icon: Droplets },
  { id: 7, label: 'Respirei fundo', icon: Wind },
  { id: 19, label: 'Saí de casa', icon: MapPin },
  { id: 17, label: 'Falei com alguém', icon: MessageCircle },
  { id: 2, label: 'Comi bem', icon: Apple },
  { id: 6, label: 'Alonguei', icon: StretchHorizontal },
  { id: 12, label: 'Abri a janela', icon: Sun },
  { id: 10, label: '5 min de silêncio', icon: Moon },
];

export default function HojePage() {
  const router = useRouter();
  const phase = usePhase();
  const [mood, setMood] = useState<Mood | null>(null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [cares, setCares] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ crisis: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  const toggle = (id: number) => setCares((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const save = async () => {
    if (!mood) return;
    setBusy(true); setErr(null);
    try {
      // Humor, cuidados e frase salvam ao mesmo tempo (antes era um depois do outro).
      const [, , journal] = await Promise.all([
        logMood(mood, feeling),
        markHabitsToday(cares).catch(() => 0),
        note.trim() ? noricaApi.journalSave('hoje', note.trim()) : Promise.resolve(null),
      ]);
      const crisis = !!journal?.crisis;
      try { localStorage.setItem('norica-hoje', new Date().toLocaleDateString('en-CA')); } catch (_e) {}
      setDone({ crisis: crisis || mood === 'sos' });
      if (!crisis && mood !== 'sos') { try { confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 }, colors: ['#34d399', '#5eead4', '#fbbf24'] }); } catch (_e) {} }
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar agora. Tente de novo.'); } finally { setBusy(false); }
  };

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="hoje">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.25em]"><Timer size={12} /> Hoje em 1 minuto</span>
        </div>

        {done ? (
          <section className="pt-10 text-center space-y-4" data-testid="hoje-pronto">
            <div className="w-20 h-20 mx-auto rounded-[2rem] bg-emerald-400/15 text-emerald-300 flex items-center justify-center card-in"><Check size={38} /></div>
            <h1 className="text-3xl font-black tracking-tighter">Minuto de cuidado feito.</h1>
            <p className="text-sm text-white/60 font-semibold leading-relaxed">
              {phase ? 'Obrigada por se olhar mesmo num período difícil. Um dia de cada vez.' : 'Você registrou seu mar, um cuidado e um pedaço do seu dia. Pequeno e constante é o que faz diferença.'}
            </p>
            {done.crisis && (
              <div className="p-5 rounded-[2rem] bg-rose-400/10 border border-rose-300/25 text-left space-y-3">
                <p className="text-sm font-black text-rose-100">Parece que hoje está pesado. Você não precisa passar por isso sozinho.</p>
                <div className="flex gap-2">
                  <a href="tel:188" className="flex-1 py-3 rounded-xl bg-rose-300 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Phone size={12} /> Ligar 188</a>
                  <button onClick={() => router.push('/porto/')} className="flex-1 py-3 rounded-xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest">Conversar</button>
                </div>
                <button onClick={() => setHelp(true)} className="w-full text-[10px] font-black uppercase tracking-widest text-white/50 underline underline-offset-4">Mais formas de ajuda</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => router.push('/')} className="py-3.5 rounded-2xl bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-widest">Voltar à Início</button>
              <button onClick={() => router.push('/meditacoes/')} className="py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">Meditar 3 min</button>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-3">
              <h1 className="text-3xl font-black tracking-tighter leading-none">Como está seu mar <span className="text-emerald-300 italic">agora?</span></h1>
              <div className="grid grid-cols-4 gap-2">
                {MOODS.map((m) => (
                  <button key={m} onClick={() => { setMood(m); setFeeling(null); }} aria-pressed={mood === m}
                    className="py-4 rounded-2xl border text-[11px] font-black uppercase tracking-tight transition-colors"
                    style={mood === m ? { background: `${MOOD_COLOR[m]}26`, borderColor: `${MOOD_COLOR[m]}80`, color: '#fff' } : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                    data-testid={`hoje-${m}`}>
                    <span className="block w-2.5 h-2.5 rounded-full mx-auto mb-1.5" style={{ background: MOOD_COLOR[m] }} />
                    {MOOD_LABEL[m]}
                  </button>
                ))}
              </div>
              {mood && mood !== 'sos' && (
                <div className="flex flex-wrap gap-1.5 card-in">
                  {FEELINGS[mood].words.map((w) => (
                    <button key={w} onClick={() => setFeeling(feeling === w ? null : w)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${feeling === w ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-white/50'}`}>{w}</button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-tighter text-white/80">Um cuidado de hoje</h2>
              <div className="grid grid-cols-2 gap-2">
                {CARES.map((c) => (
                  <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={cares.includes(c.id)} className={`flex items-center gap-2 px-3 py-3 rounded-2xl border text-[12px] font-bold text-left ${cares.includes(c.id) ? 'bg-emerald-400/15 border-emerald-300/40 text-emerald-100' : 'bg-white/[0.04] border-white/10 text-white/60'}`}>
                    {cares.includes(c.id) ? <Check size={15} className="text-emerald-300 shrink-0" /> : <c.icon size={15} className="shrink-0 opacity-70" />} {c.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-tighter text-white/80">Uma frase sobre hoje <span className="text-white/35 normal-case tracking-normal font-semibold">(opcional)</span></h2>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} placeholder="Ex.: o dia foi corrido, mas consegui almoçar com calma." className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-300/40 placeholder:text-white/25 resize-none" data-testid="hoje-frase" />
              <p className="text-[10px] text-white/35 font-semibold">Fica no seu diário, criptografada. Só você vê.</p>
            </section>

            {err && <p className="text-xs font-bold text-rose-300">{err}</p>}
            <button onClick={save} disabled={!mood || busy} className="w-full py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2" data-testid="hoje-salvar">
              {busy && <Loader2 size={14} className="animate-spin" />} Salvar meu minuto
            </button>
          </>
        )}
      </div>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </main>
  );
}
