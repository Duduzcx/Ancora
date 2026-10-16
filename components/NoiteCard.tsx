"use client";

// Atalho para o Modo noite e os sons na Início. À noite o convite fica mais direto.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, ChevronRight } from 'lucide-react';

export default function NoiteCard() {
  const router = useRouter();
  const [night, setNight] = useState(false);
  useEffect(() => {
    const check = () => { const h = new Date().getHours(); setNight(h >= 21 || h < 5); };
    check();
    const t = setInterval(check, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <button
      onClick={() => router.push('/noite/')}
      data-testid="noite-card" data-night={night ? "1" : "0"}
      className="w-full group p-6 rounded-3xl bg-gradient-to-br from-indigo-950/70 to-[#0b0f19] border border-indigo-400/15 active:scale-[0.98] transition-transform text-left flex items-center gap-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] page-enter"
    >
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-200 flex items-center justify-center shrink-0"><Moon size={26} /></div>
      <div className="flex-1">
        <p className="text-[9px] font-black text-indigo-300/80 uppercase tracking-[0.3em]">{night ? 'Modo noite' : 'Modo noite & sons'}</p>
        <p className="text-base font-black text-white tracking-tight leading-snug">
          {night ? 'Sem sono? Respire devagar, esvazie a mente e ouça o mar.' : 'Ondas do mar, chuva e ruído branco para relaxar ou dormir.'}
        </p>
      </div>
      <ChevronRight size={18} className="text-indigo-200/50" />
    </button>
  );
}
