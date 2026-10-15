"use client";

// Consentimento LGPD para dados emocionais (dados pessoais sensíveis, art. 11, I).
// Aparece uma vez por conta, por cima de qualquer tela, no estilo do app.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

export const CONSENT_VERSION = '2026-10';
const LOCAL_KEY = `norica-consent-${CONSENT_VERSION}`;

export default function ConsentGate({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) { setOpen(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (localStorage.getItem(LOCAL_KEY) === userId) return;
      } catch (_e) {}
      const { data, error } = await supabase
        .from('consents')
        .select('version')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) return; // tabela ainda não migrada: não bloqueia o app
      if (data?.version === CONSENT_VERSION) {
        try { localStorage.setItem(LOCAL_KEY, userId); } catch (_e) {}
      } else {
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const accept = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('consents')
      .upsert({ user_id: userId, version: CONSENT_VERSION, accepted_at: new Date().toISOString() });
    setSaving(false);
    if (error) { setError('Não foi possível salvar. Verifique sua conexão.'); return; }
    try { localStorage.setItem(LOCAL_KEY, userId); } catch (_e) {}
    setOpen(false);
  };

  const decline = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-lg bg-[#0b0f19] border border-white/10 rounded-t-[2.5rem] md:rounded-[2.5rem] p-7 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-5">
              <ShieldCheck size={26} />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter leading-tight mb-2">Antes de zarpar</h2>
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-5">Seus dados, suas regras</p>
            <div className="space-y-3 text-sm text-white/70 font-semibold leading-relaxed">
              <p>Para funcionar, o Nórica guarda informações sobre como você se sente: o estado do seu mar, suas conversas no Porto e o que você sela no Cofre. A lei trata isso como <b className="text-white">dado sensível</b>, por isso pedimos sua autorização.</p>
              <p>Conversas e Cofre são <b className="text-white">criptografados</b>. Usamos a Supabase (servidor) e a Groq (inteligência artificial) só para o app funcionar. Nunca vendemos nem usamos seus dados para anúncios.</p>
              <p>Você pode excluir tudo quando quiser em <b className="text-white">Perfil → Excluir Minha Conta</b>.</p>
              <p className="text-[11px] text-white/40">O Nórica é um apoio e não substitui atendimento profissional. Em crise, ligue 188 (CVV) ou 192 (SAMU). Uso destinado a maiores de 18 anos.</p>
            </div>
            <a href="/privacidade/" className="inline-block mt-4 text-[10px] font-black text-emerald-400 uppercase tracking-widest underline underline-offset-4">
              Ler a Política de Privacidade
            </a>
            {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mt-4">{error}</p>}
            <div className="flex flex-col gap-3 mt-6">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={accept}
                disabled={saving}
                className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Concordo e quero continuar
              </motion.button>
              <button
                onClick={decline}
                className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest text-[10px]"
              >
                Não concordo — sair
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
