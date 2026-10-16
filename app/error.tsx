"use client";

// Tela mostrada quando alguma página quebra: em vez de tela branca, a pessoa pode tentar
// de novo ou voltar ao início. O erro é registrado para a equipe (tabela app_errors).

import { useEffect } from 'react';
import { Anchor, RotateCcw } from 'lucide-react';
import { reportError } from '@/lib/error-report';

export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, 'tela');
  }, [error]);

  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-[#020e10]">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
          <Anchor size={28} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tighter italic">A maré virou por aqui</h1>
          <p className="text-sm text-white/60 font-semibold leading-relaxed">
            Algo não saiu como esperado nesta tela. Já registramos o problema para corrigir.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} /> Tentar de novo
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-black uppercase tracking-widest text-[10px]"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    </main>
  );
}
