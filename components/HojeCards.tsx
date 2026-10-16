"use client";

// Cards do dia na Início: passo da trilha, carta que chegou e campanha da instituição.
// Tudo vem do que já está salvo no aparelho: aparece na hora, sem esperar a internet.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Mail, Route, X } from 'lucide-react';
import { getTracks, todayStep } from '@/lib/trilhas';
import { arrivedLetter } from '@/lib/cartas';
import { cacheGet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import type { OrgCampaign, OrgInfo } from '@/lib/norica-api';
import { CAMPAIGN_TEMPLATES } from '@/lib/campanhas';

const card = 'w-full p-6 rounded-3xl border text-left flex items-center gap-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] active:scale-[0.98] transition-transform page-enter';
const DISMISS_KEY = 'norica-campanhas-vistas';

export default function HojeCards() {
  const router = useRouter();
  const [step, setStep] = useState<ReturnType<typeof todayStep>>(null);
  const [letter, setLetter] = useState(false);
  const [campaign, setCampaign] = useState<OrgCampaign | null>(null);

  useEffect(() => {
    const refresh = () => {
      setStep(todayStep(getTracks()));
      setLetter(!!arrivedLetter());
      const org = cacheGet<{ org: OrgInfo }>(getAuthState().user?.id, 'org')?.org;
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch (_e) {}
      const today = new Date().toLocaleDateString('en-CA');
      setCampaign(org?.campaigns?.find((c) => c.starts_on <= today && c.ends_on >= today && !seen.includes(c.id)) ?? null);
    };
    refresh();
    const t = setTimeout(refresh, 3500); // depois que o app atualiza as informações em segundo plano
    window.addEventListener('norica-trilhas', refresh);
    window.addEventListener('norica-cartas', refresh);
    return () => { clearTimeout(t); window.removeEventListener('norica-trilhas', refresh); window.removeEventListener('norica-cartas', refresh); };
  }, []);

  const dismiss = (id: string) => {
    try {
      const seen = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...seen, id].slice(-30)));
    } catch (_e) {}
    setCampaign(null);
  };

  const tpl = campaign ? CAMPAIGN_TEMPLATES[campaign.kind] : null;

  return (
    <>
      {campaign && tpl && (
        <div className={`${card} bg-gradient-to-br from-amber-950/50 to-[#0b0f19] border-amber-300/20 relative`} data-testid="campanha-card">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/15 flex items-center justify-center text-2xl shrink-0">{tpl.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-amber-300/80 uppercase tracking-[0.3em]">Da sua instituição</p>
            <p className="text-base font-black text-white tracking-tight leading-snug">{campaign.title}</p>
            <p className="text-[12px] text-white/60 font-semibold leading-snug mt-1">{campaign.message}</p>
            {tpl.action && (
              <button onClick={() => router.push(tpl.action!.href)} className="mt-2 text-[10px] font-black text-amber-300 uppercase tracking-widest underline underline-offset-4">{tpl.action.label}</button>
            )}
          </div>
          <button onClick={() => dismiss(campaign.id)} aria-label="Dispensar" className="absolute top-4 right-4 p-1 text-white/30"><X size={14} /></button>
        </div>
      )}

      {letter && (
        <button onClick={() => router.push('/cartas/')} className={`${card} bg-gradient-to-br from-rose-950/60 to-[#0b0f19] border-rose-300/20`} data-testid="carta-card">
          <div className="w-14 h-14 rounded-2xl bg-rose-400/15 text-rose-200 flex items-center justify-center shrink-0"><Mail size={26} className="animate-pulse" /></div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-rose-300/80 uppercase tracking-[0.3em]">Carta para o futuro</p>
            <p className="text-base font-black text-white tracking-tight leading-snug">Uma carta sua chegou. Hoje é o dia de ler. 💌</p>
          </div>
          <ChevronRight size={18} className="text-rose-200/50" />
        </button>
      )}

      {step && !step.finished && step.step && (
        <button onClick={() => router.push('/trilhas/')} className={`${card} bg-gradient-to-br from-emerald-950/60 to-[#0b0f19] border-emerald-400/20`} data-testid="trilha-card">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0"><Route size={26} /></div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.3em]">{step.track.emoji} Trilha · dia {step.index + 1} de 7</p>
            <p className="text-base font-black text-white tracking-tight leading-snug">{step.doneToday ? 'Passo de hoje feito! ✓' : step.step.title}</p>
          </div>
          <ChevronRight size={18} className="text-emerald-200/50" />
        </button>
      )}
    </>
  );
}
