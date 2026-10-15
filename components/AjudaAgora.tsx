"use client";

// Protocolo de crise: acesso rápido a ajuda humana (CVV 188 e SAMU 192).
// Segue o visual do app: cards arredondados, tipografia black em caixa alta, verde Nórica.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, LifeBuoy, MessageCircle, X, HeartHandshake } from 'lucide-react';

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
            className="fixed inset-x-0 bottom-0 z-[1001] bg-[#0b0f19] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-w-lg mx-auto"
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
    </motion.div>
  );
}

export { HelpActions };
