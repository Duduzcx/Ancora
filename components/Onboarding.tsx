"use client";

// Começo guiado: 3 telas curtas depois do consentimento.
// 1) o que a Nórica faz, 2) horário do lembrete diário, 3) uma pessoa de confiança.
// Aparece uma vez por conta (dá para pular a qualquer momento).

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LifeBuoy, CheckCircle2, Compass, MessageCircleHeart, Bell, UserPlus, Loader2, Anchor } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { firstName } from '@/lib/user-name';
import { CONSENT_VERSION } from '@/components/ConsentGate';
import { dismissReminderInvite, enableReminder } from '@/lib/reminder';
import { EMPTY_PLAN, cachedPlan, savePlan } from '@/lib/safety-plan';
import { Capacitor } from '@capacitor/core';
import PermitirNotificacoes from '@/components/PermitirNotificacoes';

const doneKey = (uid: string) => `norica-onboarding:${uid}`;
const TIMES = ['08:00', '12:30', '20:00', '22:00'];

export default function Onboarding() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [time, setTime] = useState('20:00');
  const [contact, setContact] = useState({ nome: '', telefone: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) { setOpen(false); return; }
    const check = () => {
      try {
        const consented = localStorage.getItem(`norica-consent-${CONSENT_VERSION}`) === user.id;
        const done = !!localStorage.getItem(doneKey(user.id));
        setOpen(consented && !done);
      } catch (_e) {}
    };
    check();
    window.addEventListener('norica-consent-ok', check);
    return () => window.removeEventListener('norica-consent-ok', check);
  }, [user?.id]);

  const finish = () => {
    if (user?.id) try { localStorage.setItem(doneKey(user.id), new Date().toISOString()); } catch (_e) {}
    setOpen(false);
  };

  const enableDaily = async () => {
    setBusy(true);
    setNote(null);
    const [h, m] = time.split(':').map(Number);
    const r = await enableReminder(h, m);
    dismissReminderInvite();
    setBusy(false);
    if (r === 'denied') { setNote('Falta só permitir as notificações:'); return; }
    setStep(2);
  };

  const saveContact = async () => {
    if (!contact.nome.trim() || !contact.telefone.trim()) { finish(); return; }
    setBusy(true);
    try {
      const base = cachedPlan() ?? EMPTY_PLAN;
      await savePlan({ ...base, contatos: [{ nome: contact.nome.trim(), telefone: contact.telefone.trim() }, ...base.contatos].slice(0, 3) });
    } catch (_e) {
      // fica guardado no aparelho mesmo sem internet
    }
    setBusy(false);
    setStep(3);
  };

  const name = user ? firstName(user) : '';
  const native = Capacitor.isNativePlatform();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1900] bg-[#020a0d]/95 backdrop-blur-xl flex items-end md:items-center justify-center"
        >
          <div className="w-full max-w-lg p-7 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= Math.min(step, 2) ? 'w-8 bg-emerald-400' : 'w-4 bg-white/15'}`} />
                ))}
              </div>
              {step < 3 && (
                <button onClick={finish} className="text-[10px] font-black text-white/40 uppercase tracking-widest">Pular</button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><Anchor size={26} /></div>
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">Bem-vindo(a){name && name !== 'Navegador' ? `, ${name}` : ''}. 🌊</h2>
                    <p className="text-sm text-white/60 font-semibold leading-relaxed mt-2">A Nórica é o seu porto seguro no bolso. Em um minuto por dia, ela te ajuda a se entender melhor.</p>
                  </div>
                  <ul className="space-y-3">
                    {[
                      { icon: MessageCircleHeart, t: 'Porto', d: 'Converse quando quiser: desabafar, organizar as ideias ou se acalmar.' },
                      { icon: CheckCircle2, t: 'Logs', d: 'Pequenas vitórias do dia, como beber água ou sair de casa.' },
                      { icon: Compass, t: 'Farol', d: 'Veja seus padrões e o resumo da semana.' },
                      { icon: LifeBuoy, t: 'S.O.S', d: 'Ajuda imediata nos momentos difíceis, a um toque.' },
                    ].map((x) => (
                      <li key={x.t} className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                        <x.icon size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-white/75 font-semibold leading-snug"><b className="text-white">{x.t}:</b> {x.d}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setStep(native ? 1 : 2)} className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[11px]">Continuar</button>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/15 text-sky-300 flex items-center justify-center"><Bell size={26} /></div>
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">Um convite por dia?</h2>
                    <p className="text-sm text-white/60 font-semibold leading-relaxed mt-2">A Nórica te chama com carinho, no horário que você escolher, para registrar como está o seu mar.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {TIMES.map((t) => (
                      <button key={t} onClick={() => setTime(t)} className={`py-3 rounded-2xl border text-xs font-black ${time === t ? 'bg-sky-500/20 border-sky-400/40 text-sky-200' : 'bg-white/5 border-white/10 text-white/60'}`}>{t}</button>
                    ))}
                  </div>
                  {note && <p className="text-xs font-bold text-sky-300">{note}</p>}
                  {note && <PermitirNotificacoes compact onGranted={() => { setNote(null); enableDaily(); }} />}
                  <div className="space-y-3">
                    <button onClick={enableDaily} disabled={busy} className="w-full py-4 rounded-2xl bg-sky-500 text-slate-950 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
                      {busy && <Loader2 size={14} className="animate-spin" />} Quero o lembrete às {time}
                    </button>
                    <button onClick={() => { dismissReminderInvite(); setStep(2); }} className="w-full py-3 text-white/50 font-black uppercase tracking-widest text-[10px]">Agora não</button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/15 text-rose-300 flex items-center justify-center"><UserPlus size={26} /></div>
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">Quem você chamaria num dia difícil?</h2>
                    <p className="text-sm text-white/60 font-semibold leading-relaxed mt-2">Essa pessoa aparece no botão de ajuda e no S.O.S: um toque abre o WhatsApp com uma mensagem pronta. Só você vê.</p>
                  </div>
                  <div className="space-y-3">
                    <input value={contact.nome} onChange={(e) => setContact((c) => ({ ...c, nome: e.target.value }))} placeholder="Nome (ex.: Ana)" className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-400/50 placeholder:text-white/25" />
                    <input value={contact.telefone} onChange={(e) => setContact((c) => ({ ...c, telefone: e.target.value }))} placeholder="WhatsApp (ex.: 11 99999-9999)" inputMode="tel" className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-400/50 placeholder:text-white/25" />
                  </div>
                  <div className="space-y-3">
                    <button onClick={saveContact} disabled={busy} className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
                      {busy && <Loader2 size={14} className="animate-spin" />} {contact.nome.trim() && contact.telefone.trim() ? 'Salvar e terminar' : 'Terminar'}
                    </button>
                    {!(contact.nome.trim() && contact.telefone.trim()) && (
                      <p className="text-[11px] text-white/40 font-semibold text-center">Dá para cadastrar depois em Perfil → Plano de Segurança.</p>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><CheckCircle2 size={30} /></div>
                  <h2 className="text-3xl font-black text-white tracking-tighter">Tudo pronto. ⚓</h2>
                  <p className="text-sm text-white/60 font-semibold leading-relaxed">Comece contando como está o seu mar hoje.</p>
                  <button onClick={finish} className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[11px]">Começar</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
