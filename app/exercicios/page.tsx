"use client";

// Exercícios guiados curtos: aterramento 5-4-3-2-1, gratidão e preparação para uma
// conversa difícil (que termina num treino na Arena).

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Eye, Hand, Ear, Flower2, Coffee, Sparkles, MessagesSquare, Loader2, CheckCircle2, Sword, Heart, LifeBuoy, ChevronRight, Moon, Waves,
} from 'lucide-react';
import { noricaApi, type JournalEntry } from '@/lib/norica-api';
import { HelpSheet } from '@/components/AjudaAgora';

type Exercise = 'aterramento' | 'gratidao' | 'conversa' | null;

const GROUNDING = [
  { n: 5, icon: Eye, title: 'coisas que você vê', hint: 'Olhe ao redor devagar. Pode ser uma cor, uma luz, um objeto pequeno.' },
  { n: 4, icon: Hand, title: 'coisas que você pode tocar', hint: 'Sinta a textura da roupa, o chão sob os pés, a temperatura das mãos.' },
  { n: 3, icon: Ear, title: 'sons que você ouve', hint: 'Perto e longe: um carro, um ventilador, sua própria respiração.' },
  { n: 2, icon: Flower2, title: 'cheiros que você sente', hint: 'Se não sentir nenhum, lembre de dois cheiros de que você gosta.' },
  { n: 1, icon: Coffee, title: 'gosto na boca', hint: 'Ou tome um gole de água e preste atenção nele.' },
];

const CARDS: { id: Exclude<Exercise, null>; title: string; desc: string; time: string; icon: any; color: string }[] = [
  { id: 'aterramento', title: 'Aterramento 5-4-3-2-1', desc: 'Volte para o agora usando os cinco sentidos. Bom para ansiedade e pensamentos acelerados.', time: '3 min', icon: Eye, color: 'text-sky-300 bg-sky-500/10 border-sky-500/20' },
  { id: 'gratidao', title: 'Três coisas boas', desc: 'Escreva três coisas pelas quais você é grato(a) hoje, mesmo pequenas.', time: '2 min', icon: Heart, color: 'text-rose-300 bg-rose-500/10 border-rose-500/20' },
  { id: 'conversa', title: 'Preparar uma conversa difícil', desc: 'Organize o que sente e o que quer pedir — e depois treine na Arena.', time: '5 min', icon: MessagesSquare, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
];

export default function ExerciciosPage() {
  const router = useRouter();
  const [active, setActive] = useState<Exercise>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const ex = new URLSearchParams(window.location.search).get('ex');
    if (ex === 'aterramento' || ex === 'gratidao' || ex === 'conversa') setActive(ex);
  }, []);

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-40 bg-[#020617]">
      <div className="relative z-10 max-w-2xl mx-auto p-6 pt-[calc(env(safe-area-inset-top,44px)+2rem)] space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => (active ? setActive(null) : router.back())}
            className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white shadow-sm active:scale-95"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <button onClick={() => setHelpOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-300">
            <LifeBuoy size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ajuda</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!active && (
            <motion.div key="lista" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="space-y-3">
                <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
                  Exercícios <span className="text-emerald-400 italic">guiados.</span>
                </h1>
                <p className="text-white/55 font-bold text-sm leading-relaxed">Pequenas práticas para os momentos em que você precisa de um caminho.</p>
              </div>
              {CARDS.map((c) => (
                <motion.button
                  key={c.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActive(c.id)}
                  className="w-full text-left p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-4"
                >
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${c.color}`}>
                    <c.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-black text-white uppercase tracking-tighter">{c.title}</h2>
                    <p className="text-[12px] text-white/55 font-semibold leading-relaxed mt-1">{c.desc}</p>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-2">{c.time}</p>
                  </div>
                  <ChevronRight size={18} className="text-white/30" />
                </motion.button>
              ))}
              {[
                { href: '/noite/', title: 'Modo noite', desc: 'Para quando o sono não vem: respiração lenta, esvaziar a mente e sons com timer.', time: '5–30 min', icon: Moon, color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
                { href: '/respiracao/', title: 'Respiração 4-7-8 com sons', desc: 'Ondas do mar, chuva ou ruído branco enquanto você respira.', time: '3 min', icon: Waves, color: 'text-teal-300 bg-teal-500/10 border-teal-500/20' },
              ].map((c) => (
                <motion.button
                  key={c.href}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push(c.href)}
                  className="w-full text-left p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-4"
                >
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${c.color}`}>
                    <c.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-black text-white uppercase tracking-tighter">{c.title}</h2>
                    <p className="text-[12px] text-white/55 font-semibold leading-relaxed mt-1">{c.desc}</p>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-2">{c.time}</p>
                  </div>
                  <ChevronRight size={18} className="text-white/30" />
                </motion.button>
              ))}
            </motion.div>
          )}
          {active === 'aterramento' && <Aterramento key="a" onDone={() => setActive(null)} onHelp={() => setHelpOpen(true)} />}
          {active === 'gratidao' && <Gratidao key="g" onDone={() => setActive(null)} />}
          {active === 'conversa' && <Conversa key="c" onHelp={() => setHelpOpen(true)} />}
        </AnimatePresence>
      </div>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

const field = 'w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/25 leading-relaxed';
const primary = 'w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-40';
const secondary = 'w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-black uppercase tracking-widest text-[10px]';

function Aterramento({ onDone, onHelp }: { onDone: () => void; onHelp: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [feeling, setFeeling] = useState<string | null>(null);
  const finished = step >= GROUNDING.length;
  const s = GROUNDING[Math.min(step, GROUNDING.length - 1)];

  const finish = (f: string) => {
    setFeeling(f);
    noricaApi.journalSave('aterramento', `Aterramento 5-4-3-2-1 concluído. Depois: ${f}.`).catch(() => {});
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex gap-1.5">
        {GROUNDING.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-sky-400' : i === step ? 'bg-sky-400/50' : 'bg-white/10'}`} />
        ))}
      </div>
      {!finished ? (
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-white/5 border border-white/10 rounded-[3rem] p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-500/15 text-sky-300 flex items-center justify-center"><s.icon size={28} /></div>
            <p className="text-7xl font-black text-white tracking-tighter leading-none">{s.n}</p>
            <h2 className="text-xl font-black text-white tracking-tight">{s.title}</h2>
            <p className="text-sm text-white/60 font-semibold leading-relaxed">{s.hint}</p>
            <p className="text-[11px] text-white/40 font-semibold">Diga mentalmente ou em voz baixa. Sem pressa.</p>
            <button onClick={() => setStep(step + 1)} className={primary}>{step === GROUNDING.length - 1 ? 'Terminar' : 'Próximo'}</button>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-[3rem] p-8 text-center space-y-5">
          <h2 className="text-2xl font-black text-white tracking-tight">Você voltou para o agora. 🌊</h2>
          {!feeling ? (
            <>
              <p className="text-sm text-white/60 font-semibold">Como você está se sentindo?</p>
              <div className="grid grid-cols-3 gap-2">
                {['Melhor', 'Igual', 'Pior'].map((f) => (
                  <button key={f} onClick={() => finish(f.toLowerCase())} className="py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs">{f}</button>
                ))}
              </div>
            </>
          ) : feeling === 'melhor' ? (
            <>
              <p className="text-sm text-white/70 font-semibold">Que bom. Esse exercício está sempre aqui quando precisar.</p>
              <button onClick={onDone} className={primary}>Concluir</button>
            </>
          ) : (
            <>
              <p className="text-sm text-white/70 font-semibold leading-relaxed">Tudo bem não melhorar de uma vez. Que tal conversar com a Nórica ou fazer a respiração guiada?</p>
              <button onClick={() => router.push('/porto/?humor=ansioso')} className={primary}>Conversar no Porto</button>
              <button onClick={() => router.push('/respiracao/')} className={secondary}>Respiração guiada</button>
              <button onClick={onHelp} className="text-[10px] font-black text-rose-300 uppercase tracking-widest">Preciso de ajuda agora</button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Gratidao({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState(['', '', '']);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<JournalEntry[]>([]);

  useEffect(() => {
    noricaApi.journalList(5, 'gratidao').then((r) => setPast(r.entries)).catch(() => {});
  }, []);

  const save = async () => {
    const filled = items.map((i) => i.trim()).filter(Boolean);
    if (!filled.length) return;
    setSaving(true);
    setError(null);
    try {
      const content = filled.map((t, i) => `${i + 1}. ${t}`).join('\n');
      const { entry } = await noricaApi.journalSave('gratidao', content);
      setPast((p) => [entry, ...p].slice(0, 5));
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-white tracking-tighter">Três coisas boas de hoje</h2>
        <p className="text-sm text-white/55 font-semibold leading-relaxed">Podem ser pequenas: um café quente, uma mensagem, um minuto de sol. Notar o que é bom treina o olhar para os dias difíceis.</p>
      </div>
      {saved ? (
        <div className="bg-white/5 border border-white/10 rounded-[3rem] p-8 text-center space-y-4">
          <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
          <p className="text-lg font-black text-white">Guardado. 💚</p>
          <p className="text-sm text-white/60 font-semibold">Volte amanhã e veja como a lista cresce.</p>
          <button onClick={onDone} className={primary}>Concluir</button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((v, i) => (
            <input
              key={i}
              className={field}
              placeholder={['Hoje eu sou grato(a) por…', 'Também foi bom…', 'E ainda…'][i]}
              value={v}
              onChange={(e) => setItems(items.map((x, idx) => (idx === i ? e.target.value : x)))}
            />
          ))}
          {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
          <button onClick={save} disabled={saving || !items.some((i) => i.trim())} className={primary}>
            {saving && <Loader2 size={14} className="animate-spin" />} Guardar
          </button>
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Dias anteriores</p>
          {past.map((e) => (
            <div key={e.id} className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{new Date(e.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
              <p className="text-xs text-white/70 font-semibold whitespace-pre-line leading-relaxed mt-1">{e.content}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Conversa({ onHelp }: { onHelp: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ pessoa: '', objetivo: '', sentimento: '', pedido: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ aberturas: string[]; dica: string; cenario: string } | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const prepare = async () => {
    if (!form.pessoa.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await noricaApi.prepConversation(form);
      setPlan(r);
      if (r.crisis) onHelp();
      noricaApi.journalSave(
        'conversa',
        `Com: ${form.pessoa}\nO que quero dizer: ${form.objetivo}\nComo me sinto: ${form.sentimento}\nO que vou pedir: ${form.pedido}\nAbertura: ${r.aberturas[0] ?? ''}`,
        `Preparei uma conversa com ${form.pessoa}.`,
      ).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Não foi possível preparar agora.');
    } finally {
      setLoading(false);
    }
  };

  const train = () => {
    if (!plan) return;
    const contexto = [form.objetivo, form.pedido && `quero pedir: ${form.pedido}`].filter(Boolean).join(' — ');
    router.push(`/arena/?cenario=${encodeURIComponent(plan.cenario)}&contexto=${encodeURIComponent(contexto.slice(0, 200))}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-white tracking-tighter">Preparar uma conversa difícil</h2>
        <p className="text-sm text-white/55 font-semibold leading-relaxed">Falar do que você sente e pedir algo concreto deixa a conversa mais leve para os dois lados.</p>
      </div>
      {!plan ? (
        <div className="space-y-3">
          <input className={field} placeholder="Com quem? (ex.: minha mãe, meu chefe)" value={form.pessoa} onChange={(e) => set('pessoa', e.target.value)} />
          <textarea rows={3} className={field} placeholder="O que aconteceu ou o que você quer dizer?" value={form.objetivo} onChange={(e) => set('objetivo', e.target.value)} />
          <input className={field} placeholder="Como você se sente com isso?" value={form.sentimento} onChange={(e) => set('sentimento', e.target.value)} />
          <input className={field} placeholder="O que você quer pedir?" value={form.pedido} onChange={(e) => set('pedido', e.target.value)} />
          {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
          <button onClick={prepare} disabled={loading || !form.pessoa.trim()} className={primary}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Preparar com a Nórica
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-3">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Jeitos de começar</p>
            {plan.aberturas.map((a, i) => (
              <p key={i} className="text-sm text-white/85 font-semibold leading-relaxed border-l-2 border-emerald-500/40 pl-3">“{a}”</p>
            ))}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6">
            <p className="text-[10px] font-black text-sky-300 uppercase tracking-widest mb-2">Dica</p>
            <p className="text-sm text-white/75 font-semibold leading-relaxed">{plan.dica}</p>
          </div>
          <button onClick={train} className={primary}><Sword size={14} /> Treinar esta conversa na Arena</button>
          <button onClick={() => setPlan(null)} className={secondary}>Ajustar o que escrevi</button>
        </div>
      )}
    </motion.div>
  );
}
