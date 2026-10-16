"use client";

// Plano de segurança: um roteiro que a própria pessoa escreve num momento tranquilo,
// para usar quando a dor apertar (modelo usado por profissionais de saúde mental).
// Fica criptografado no servidor e com cópia no aparelho; abre pelo botão de ajuda.

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Wind, Users, UserPlus, Stethoscope, Heart, Trash2, LifeBuoy,
} from 'lucide-react';
import type { SafetyPlan } from '@/lib/norica-api';
import { EMPTY_PLAN, cachedPlan, loadPlan, savePlan } from '@/lib/safety-plan';
import { HelpSheet } from '@/components/AjudaAgora';

const STEPS: { key: keyof Omit<SafetyPlan, 'contatos'>; icon: any; title: string; hint: string; placeholder: string }[] = [
  {
    key: 'sinais',
    icon: AlertTriangle,
    title: '1. Meus sinais de alerta',
    hint: 'Pensamentos, sentimentos ou situações que mostram que uma crise pode estar chegando.',
    placeholder: 'Ex.: fico sem dormir, me isolo, começo a pensar que sou um peso…',
  },
  {
    key: 'acalma',
    icon: Wind,
    title: '2. O que eu faço para me acalmar',
    hint: 'Coisas que você consegue fazer sozinho(a), sem precisar de ninguém.',
    placeholder: 'Ex.: banho quente, respiração da Nórica, ouvir minha playlist, caminhar…',
  },
  {
    key: 'distrair',
    icon: Users,
    title: '3. Pessoas e lugares que me distraem',
    hint: 'Onde ir ou com quem estar para mudar o foco, sem precisar falar do problema.',
    placeholder: 'Ex.: casa da minha avó, praça perto de casa, jogar com o Lucas…',
  },
  {
    key: 'profissionais',
    icon: Stethoscope,
    title: '5. Profissionais e serviços',
    hint: 'Quem procurar quando precisar de ajuda profissional.',
    placeholder: 'Ex.: minha psicóloga, CAPS do bairro, UBS…',
  },
  {
    key: 'motivos',
    icon: Heart,
    title: '6. Meus motivos para seguir',
    hint: 'O que é importante para você e vale a pena proteger.',
    placeholder: 'Ex.: minha mãe, meu cachorro, terminar a faculdade, ver o mar de novo…',
  },
];

export default function PlanoSegurancaPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<SafetyPlan>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const local = cachedPlan();
    if (local) { setPlan(local); setLoading(false); }
    loadPlan()
      .then((p) => { if (p) setPlan(p); })
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof SafetyPlan, value: any) => {
    setMessage(null);
    setPlan((p) => ({ ...p, [key]: value }));
  };
  const updateContact = (i: number, field: 'nome' | 'telefone', value: string) =>
    update('contatos', plan.contatos.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await savePlan(plan);
      setPlan(saved);
      setMessage({ kind: 'ok', text: 'Plano salvo. Ele aparece no botão de ajuda sempre que você precisar.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: `${err?.message || 'Sem conexão.'} Seu plano ficou guardado neste celular e será salvo na conta depois.` });
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-white/25 leading-relaxed';

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-40 bg-[#020617]">
      <div className="relative z-10 max-w-2xl mx-auto p-6 pt-[calc(env(safe-area-inset-top,44px)+2rem)] space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white shadow-sm active:scale-95" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <button onClick={() => setHelpOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-300">
            <LifeBuoy size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Preciso de ajuda agora</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
            Meu plano de <span className="text-emerald-400 italic">segurança.</span>
          </h1>
          <p className="text-white/55 font-bold text-sm leading-relaxed">
            Escreva com calma, num momento tranquilo. Quando a dor apertar, você não vai precisar pensar: o caminho já estará aqui, no botão de ajuda.
            Só você vê este plano.
          </p>
        </div>

        {loading && !plan.sinais && !plan.contatos.length ? (
          <div className="flex items-center justify-center gap-3 text-white/50 text-sm font-bold py-10">
            <Loader2 size={18} className="animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-5">
            {STEPS.slice(0, 3).map((s) => (
              <Section key={s.key} icon={s.icon} title={s.title} hint={s.hint}>
                <textarea rows={3} className={field} placeholder={s.placeholder} value={plan[s.key]} onChange={(e) => update(s.key, e.target.value)} />
              </Section>
            ))}

            <Section icon={UserPlus} title="4. Pessoas de confiança" hint="Quem você pode chamar quando precisar. Aparecem no botão de ajuda com uma mensagem pronta para enviar.">
              <div className="space-y-3">
                {plan.contatos.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input className={field} placeholder="Nome" value={c.nome} onChange={(e) => updateContact(i, 'nome', e.target.value)} />
                    <input className={field} placeholder="(11) 99999-9999" inputMode="tel" value={c.telefone} onChange={(e) => updateContact(i, 'telefone', e.target.value)} />
                    <button
                      onClick={() => update('contatos', plan.contatos.filter((_, idx) => idx !== i))}
                      className="px-3 rounded-2xl bg-white/5 border border-white/10 text-white/40"
                      aria-label={`Remover ${c.nome || 'contato'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {plan.contatos.length < 3 && (
                  <button
                    onClick={() => update('contatos', [...plan.contatos, { nome: '', telefone: '' }])}
                    className="w-full py-3 rounded-2xl border border-dashed border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest"
                  >
                    + Adicionar pessoa
                  </button>
                )}
              </div>
            </Section>

            {STEPS.slice(3).map((s) => (
              <Section key={s.key} icon={s.icon} title={s.title} hint={s.hint}>
                <textarea rows={3} className={field} placeholder={s.placeholder} value={plan[s.key]} onChange={(e) => update(s.key, e.target.value)} />
              </Section>
            ))}

            {message && (
              <div className={`flex items-start gap-3 p-4 rounded-2xl border text-sm font-bold ${message.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'}`}>
                {message.kind === 'ok' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                {message.text}
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={save}
              disabled={saving}
              className="w-full py-5 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
            >
              {saving && <Loader2 size={16} className="animate-spin" />} Salvar meu plano
            </motion.button>
            <p className="text-[10px] text-white/35 font-bold text-center leading-relaxed">
              Se estiver em perigo agora, ligue 188 (CVV) ou 192 (SAMU).
            </p>
          </div>
        )}
      </div>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: any; title: string; hint: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-tighter">{title}</h2>
          <p className="text-[11px] text-white/45 font-semibold leading-relaxed mt-1">{hint}</p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}
