"use client";

// Protocolo de crise: acesso rápido a ajuda humana (CVV 188 e SAMU 192).
// Segue o visual do app: cards arredondados, tipografia black em caixa alta, verde Nórica.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, LifeBuoy, MessageCircle, X, HeartHandshake, ClipboardList, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SafetyPlan } from '@/lib/norica-api';
import { cachedPlan, hasPlan, loadPlan, phoneDigits, trustedMessage } from '@/lib/safety-plan';

const CVV_SITE = 'https://cvv.org.br/';

function call(number: string) {
  window.location.href = `tel:${number}`;
}

async function openCvvChat() {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: CVV_SITE });
  } catch (_e) {
    window.open(CVV_SITE, '_blank');
  }
}

function HelpActions({ dark = false }: { dark?: boolean }) {
  const secondary = dark
    ? 'bg-white/10 border-white/20 text-white'
    : 'bg-slate-50 border-slate-200 text-slate-900';
  return (
    <div className="flex flex-col gap-3 w-full">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => call('188')}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/20"
      >
        <Phone size={18} /> Ligar 188 — CVV (24h, grátis)
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={openCvvChat}
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border font-black uppercase tracking-widest text-xs ${secondary}`}
      >
        <MessageCircle size={18} /> Conversar por chat (CVV)
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => call('192')}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-xs"
      >
        <LifeBuoy size={18} /> Emergência — SAMU 192
      </motion.button>
    </div>
  );
}

function openExternal(url: string) {
  window.location.href = url;
}

/** Pessoas de confiança do plano de segurança + atalho para o plano. */
function TrustedContacts({ dark = true }: { dark?: boolean }) {
  const router = useRouter();
  const [plan, setPlan] = useState<SafetyPlan | null>(null);
  useEffect(() => {
    setPlan(cachedPlan());
    loadPlan(setPlan).catch(() => {});
  }, []);

  const contacts = plan?.contatos?.filter((c) => c.telefone) ?? [];
  const goToPlan = () => router.push('/plano-seguranca/');
  const secondary = dark ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-200 text-slate-900';

  return (
    <div className="flex flex-col gap-3 w-full mt-3">
      {contacts.map((c) => {
        const digits = phoneDigits(c.telefone);
        const firstName = c.nome.split(' ')[0];
        return (
          <div key={`${c.nome}-${c.telefone}`} className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => openExternal(`https://wa.me/${digits}?text=${encodeURIComponent(trustedMessage(firstName))}`)}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-sky-500 text-white font-black uppercase tracking-widest text-[10px]"
            >
              <Send size={16} /> Avisar {firstName || 'contato'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => openExternal(`tel:+${digits}`)}
              aria-label={`Ligar para ${c.nome}`}
              className={`px-5 rounded-2xl border flex items-center justify-center ${secondary}`}
            >
              <Phone size={16} />
            </motion.button>
          </div>
        );
      })}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={goToPlan}
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border font-black uppercase tracking-widest text-xs ${secondary}`}
      >
        <ClipboardList size={18} /> {hasPlan(plan) ? 'Meu plano de segurança' : 'Criar meu plano de segurança'}
      </motion.button>
    </div>
  );
}

/** Um toque para avisar a primeira pessoa de confiança (aparece só se ela estiver cadastrada). */
export function QuickTrustedButton({ className = '' }: { className?: string }) {
  const [contact, setContact] = useState<{ nome: string; telefone: string } | null>(null);
  useEffect(() => {
    const pick = (p: SafetyPlan | null) => setContact(p?.contatos?.find((c) => c.telefone) ?? null);
    pick(cachedPlan());
    loadPlan(pick).catch(() => {});
  }, []);
  if (!contact) return null;
  const firstName = contact.nome.split(' ')[0] || 'contato';
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => openExternal(`https://wa.me/${phoneDigits(contact.telefone)}?text=${encodeURIComponent(trustedMessage(firstName))}`)}
      aria-label={`Avisar ${contact.nome} que preciso de ajuda`}
      className={`p-3 rounded-2xl border flex items-center gap-2 bg-sky-500/20 border-sky-400/30 text-white ${className}`}
    >
      <Send size={18} />
      <span className="text-[9px] font-black uppercase tracking-wider">Avisar {firstName}</span>
    </motion.button>
  );
}

/** Painel de ajuda que sobe por cima da tela. */
export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <HeartHandshake size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Você não está sozinho(a)</h3>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-1">Ajuda humana agora</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-white/50" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-white/70 font-semibold leading-relaxed mb-5">
              Se a dor estiver grande demais, fale com uma pessoa agora. O CVV atende de graça, a qualquer hora, com sigilo.
              Se você estiver em perigo imediato, ligue para o SAMU.
            </p>
            <HelpActions dark />
            <TrustedContacts />
            <p className="text-[10px] text-white/40 font-bold text-center mt-4">
              A Nórica é um apoio e não substitui atendimento profissional.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Botão compacto "Ajuda" para cabeçalhos. */
export function HelpButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label="Preciso de ajuda agora"
      className={`p-3 rounded-2xl border flex items-center gap-2 transition-all ${
        dark ? 'bg-white/10 border-white/20 text-white' : 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100'
      }`}
    >
      <LifeBuoy size={18} />
      <span className="text-[9px] font-black uppercase tracking-wider">Ajuda</span>
    </motion.button>
  );
}

/** Cartão mostrado dentro da conversa quando o servidor detecta sinal de risco. */
export function CrisisCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-rose-950/30 border border-rose-500/30 backdrop-blur-md rounded-[2rem] p-5 shadow-xl max-w-[90%]"
    >
      <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-2">Estamos com você</p>
      <p className="text-sm text-white/80 font-semibold leading-relaxed mb-4">
        Percebi que você pode estar passando por algo muito difícil. Falar com alguém agora pode ajudar.
      </p>
      <HelpActions dark />
      <TrustedContacts />
    </motion.div>
  );
}

export { HelpActions, TrustedContacts };
