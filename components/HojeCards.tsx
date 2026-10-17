"use client";

// Cards do dia na Início: passo da trilha, carta que chegou e campanha da instituição.
// Tudo vem do que já está salvo no aparelho: aparece na hora, sem esperar a internet.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Flame, Mail, Route, X, Timer, HeartHandshake } from 'lucide-react';
import { usePhase, phaseLabel } from '@/lib/fase';
import { updateFlameWidget } from '@/lib/flame-widget';
import { getTracks, todayStep } from '@/lib/trilhas';
import { arrivedLetter } from '@/lib/cartas';
import { todaysDate } from '@/lib/datas';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { noricaApi, type FriendsState, type OrgCampaign, type OrgInfo } from '@/lib/norica-api';
import { CAMPAIGN_TEMPLATES } from '@/lib/campanhas';

const card = 'w-full p-6 rounded-3xl border text-left flex items-center gap-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] active:scale-[0.98] transition-transform card-in';
const DISMISS_KEY = 'norica-campanhas-vistas';

export default function HojeCards() {
  const router = useRouter();
  const [step, setStep] = useState<ReturnType<typeof todayStep>>(null);
  const [letter, setLetter] = useState(false);
  const [campaign, setCampaign] = useState<OrgCampaign | null>(null);
  const [sensitive, setSensitive] = useState<string | null>(null);
  const phase = usePhase();
  const [minuteDone, setMinuteDone] = useState(true);
  const [friends, setFriends] = useState<FriendsState | null>(() => cacheGet<FriendsState>(getAuthState().user?.id, 'friends'));

  useEffect(() => {
    const refresh = () => {
      setStep(todayStep(getTracks()));
      setLetter(!!arrivedLetter());
      setSensitive(todaysDate()?.label ?? null);
      try { setMinuteDone(localStorage.getItem('norica-hoje') === new Date().toLocaleDateString('en-CA')); } catch (_e) { setMinuteDone(false); }
      const org = cacheGet<{ org: OrgInfo }>(getAuthState().user?.id, 'org')?.org;
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch (_e) {}
      const today = new Date().toLocaleDateString('en-CA');
      setCampaign(org?.campaigns?.find((c) => c.starts_on <= today && c.ends_on >= today && !seen.includes(c.id)) ?? null);
    };
    refresh();
    const t = setTimeout(refresh, 3500); // depois que o app atualiza as informações em segundo plano
    const f = setTimeout(() => {
      noricaApi.friendsList().then((s) => { if (!Array.isArray(s?.friends)) return; setFriends(s); cacheSet(getAuthState().user?.id, 'friends', s); updateFlameWidget(s); }).catch(() => {});
    }, 1500);
    window.addEventListener('norica-trilhas', refresh);
    window.addEventListener('norica-cartas', refresh);
    return () => { clearTimeout(t); clearTimeout(f); window.removeEventListener('norica-trilhas', refresh); window.removeEventListener('norica-cartas', refresh); };
  }, []);

  const dismiss = (id: string) => {
    try {
      const seen = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...seen, id].slice(-30)));
    } catch (_e) {}
    setCampaign(null);
  };

  const tpl = campaign ? CAMPAIGN_TEMPLATES[campaign.kind] : null;
  // Foguinho: um card só — um carinho recebido, ou um amigo que já marcou e espera você.
  // Prioridade: mensagem nova > carinho recebido > amigo sumido > amigo esperando você marcar.
  const list = Array.isArray(friends?.friends) ? friends!.friends : [];
  const unread = list.find((x) => (x.unread ?? 0) > 0) ?? null;
  const nudge = (!unread && Array.isArray(friends?.nudges) && friends!.nudges[0]) || null;
  const away = !unread && !nudge ? list.find((x) => x.daysAway != null && x.daysAway >= 3 && x.daysAway <= 14) ?? null : null;
  const waiting = !unread && !nudge && !away ? list.find((x) => x.friendToday && !x.meToday) ?? null : null;
  const NUDGE_LINE = { apoio: 'te mandou apoio 💛', pensei: 'pensou em você 🌊', parabens: 'comemorou com você 🎉', sumido: 'perguntou se está tudo bem com você 💙' } as const;

  return (
    <>
      {phase && (
        <button onClick={() => router.push('/fase/')} className={`${card} bg-gradient-to-br from-sky-950/60 to-[#0b0f19] border-sky-300/20`} data-testid="fase-card">
          <div className="w-14 h-14 rounded-2xl bg-sky-400/15 text-sky-200 flex items-center justify-center shrink-0"><HeartHandshake size={26} /></div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-sky-300/80 uppercase tracking-[0.3em]">Fase difícil · {phaseLabel(phase.kind).toLowerCase()}</p>
            <p className="text-base font-black text-white tracking-tight leading-snug">Hoje não precisa render. Um cuidado pequeno já basta. 💙</p>
          </div>
          <ChevronRight size={18} className="text-sky-200/50" />
        </button>
      )}

      {!minuteDone && (
        <button onClick={() => router.push('/hoje/')} className={`${card} bg-gradient-to-br from-emerald-950/60 to-[#0b0f19] border-emerald-300/20`} data-testid="hoje-card">
          <div className="w-14 h-14 rounded-2xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0"><Timer size={26} /></div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.3em]">Hoje em 1 minuto</p>
            <p className="text-base font-black text-white tracking-tight leading-snug">Seu mar, um cuidado e uma frase — tudo numa tela.</p>
          </div>
          <ChevronRight size={18} className="text-emerald-200/50" />
        </button>
      )}

      {sensitive && (
        <div className={`${card} bg-gradient-to-br from-sky-950/60 to-[#0b0f19] border-sky-300/20`} data-testid="data-sensivel-card">
          <div className="w-14 h-14 rounded-2xl bg-sky-400/15 text-sky-200 flex items-center justify-center shrink-0 text-2xl">💙</div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-sky-300/80 uppercase tracking-[0.3em]">Hoje é um dia que pesa</p>
            <p className="text-base font-black text-white tracking-tight leading-snug first-letter:uppercase">{sensitive}. Vá com calma — está tudo bem não estar bem hoje.</p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => router.push('/porto/')} className="text-[10px] font-black text-sky-300 uppercase tracking-widest underline underline-offset-4">Conversar</button>
              <button onClick={() => router.push('/calma/?abrir=1')} className="text-[10px] font-black text-amber-200 uppercase tracking-widest underline underline-offset-4">Caixa de calma</button>
            </div>
          </div>
        </div>
      )}

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

      {(unread || nudge || away || waiting) && (
        <button onClick={() => router.push(unread ? `/amigos/chat/?pair=${unread.pairId}` : '/amigos/')} className={`${card} bg-gradient-to-br from-orange-950/60 to-[#0b0f19] border-orange-300/20`} data-testid="foguinho-card">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/15 text-orange-300 flex items-center justify-center shrink-0"><Flame size={26} fill="currentColor" className="flame-flicker" /></div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-orange-300/80 uppercase tracking-[0.3em]">Foguinho</p>
            <p className="text-base font-black text-white tracking-tight leading-snug">
              {unread ? `${unread.name} te mandou ${unread.unread === 1 ? 'uma mensagem' : `${unread.unread} mensagens`} 💬`
                : nudge ? `${nudge.from} ${NUDGE_LINE[nudge.kind] ?? NUDGE_LINE.apoio}`
                : away ? `Faz ${away.daysAway} dias que ${away.name} não aparece. Que tal mandar um "tá tudo bem?" 💙`
                : `🔥 ${waiting!.streak} com ${waiting!.name}. ${waiting!.name} já marcou o dia — e você?`}
            </p>
          </div>
          <ChevronRight size={18} className="text-orange-200/50" />
        </button>
      )}

      {letter && (
        <button onClick={() => router.push('/cartas/')} className={`${card} bg-gradient-to-br from-rose-950/60 to-[#0b0f19] border-rose-300/20`} data-testid="carta-card">
          <div className="w-14 h-14 rounded-2xl bg-rose-400/15 text-rose-200 flex items-center justify-center shrink-0"><Mail size={26} className="css-tilt" /></div>
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
