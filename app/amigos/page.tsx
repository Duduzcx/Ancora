"use client";

// Foguinho com amigos: os dois marcam o dia e a chama cresce. Gentil por padrão:
// um dia de descanso por semana não apaga a chama, e ninguém vê o conteúdo do outro.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, Flame, UserPlus, Loader2, Heart, Sparkles, Check, X, ShieldCheck } from 'lucide-react';
import { noricaApi, type Friend, type FriendsState } from '@/lib/norica-api';
import { getAuthState, useAuth } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { firstName } from '@/lib/user-name';
import { shareText, STORE_URL } from '@/lib/share-text';
import PenseiEmVoce from '@/components/PenseiEmVoce';

const NUDGE_TEXT = { apoio: 'te mandou apoio 💛', pensei: 'pensou em você 🌊', parabens: 'comemorou com você 🎉' } as const;

function FlameBadge({ n, lit }: { n: number; lit: boolean }) {
  return (
    <div className={`relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${lit ? 'bg-orange-500/15' : 'bg-white/5'}`}>
      <Flame size={26} className={lit ? 'text-orange-400 flame-flicker' : 'text-white/25'} fill={lit ? 'currentColor' : 'none'} />
      <span className={`text-sm font-black tabular-nums ${lit ? 'text-orange-200' : 'text-white/40'}`}>{n}</span>
    </div>
  );
}

export default function AmigosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = getAuthState().user?.id;
  const [state, setState] = useState<FriendsState | null>(() => cacheGet<FriendsState>(uid, 'friends'));
  const [code, setCode] = useState('');
  const [myCode, setMyCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const apply = (s: FriendsState) => { if (!Array.isArray(s?.friends)) return; setState(s); cacheSet(uid, 'friends', s); };
  useEffect(() => {
    noricaApi.friendsList().then((s) => {
      apply(s);
      if (s?.nudges?.length) noricaApi.friendsSeen().catch(() => {});
    }).catch(() => setState((p) => p ?? { friends: [], nudges: [], max: 5 }));
  }, []);

  const invite = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await noricaApi.friendsInvite();
      setMyCode(r.code);
      await shareText(`Bora acender um foguinho de cuidado comigo na Nórica? 🔥 A gente só marca como está o dia e a chama cresce.\n\nMeu código: ${r.code}\n${STORE_URL}`, 'Foguinho na Nórica');
    } catch (e: any) { setMsg(e?.message || 'Não foi possível criar o convite.'); } finally { setBusy(false); }
  };
  const join = async () => {
    setBusy(true); setMsg(null);
    try {
      apply(await noricaApi.friendsJoin(code));
      setCode('');
      try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#fb923c', '#fbbf24', '#f472b6'] }); } catch (_e) {}
      setMsg('Foguinho aceso! 🔥 Marquem o dia para a chama crescer.');
    } catch (e: any) { setMsg(e?.message || 'Código não encontrado.'); } finally { setBusy(false); }
  };
  const nudge = async (f: Friend, kind: 'apoio' | 'pensei' | 'parabens') => {
    try { await noricaApi.friendsNudge(f.pairId, kind); setSent(`${f.pairId}:${kind}`); setTimeout(() => setSent(null), 2500); }
    catch (e: any) { setMsg(e?.message || 'Não foi possível enviar agora.'); }
  };
  const remove = async (f: Friend) => {
    if (!window.confirm(`Apagar o foguinho com ${f.name}?`)) return;
    try { apply(await noricaApi.friendsRemove(f.pairId)); } catch (_e) {}
  };

  return (
    <main className="min-h-[100dvh] bg-[#0f0906] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="amigos">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.16)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-orange-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-orange-200/80 uppercase tracking-[0.25em]">Foguinho com amigos</span>
        </div>
        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Cuidar junto <span className="text-orange-300 italic">aquece.</span> 🔥</h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Quando os dois marcam o dia na Nórica, a chama cresce. Um dia de descanso por semana não apaga.</p>
          <p className="flex items-start gap-2 text-[11px] text-white/40 font-semibold"><ShieldCheck size={13} className="shrink-0 mt-0.5" /> Seu amigo só vê se você marcou o dia — nunca o que você escreveu ou sentiu.</p>
        </div>

        {state?.nudges.map((n) => (
          <div key={n.id} className="p-4 rounded-2xl bg-orange-400/10 border border-orange-300/25 text-sm font-bold" data-testid="nudge">
            <b className="text-orange-200">{n.from}</b> {NUDGE_TEXT[n.kind]}
          </div>
        ))}

        {!state && <div className="space-y-3"><div className="skeleton h-24 rounded-[2rem]" /><div className="skeleton h-24 rounded-[2rem]" /></div>}

        {state?.friends.map((f) => (
          <section key={f.pairId} className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-4" data-testid="amigo">
            <div className="flex items-center gap-4">
              <FlameBadge n={f.streak} lit={f.streak > 0} />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black truncate">{f.name}</p>
                <p className="text-[11px] text-white/50 font-semibold">
                  {f.bothToday ? 'Vocês dois marcaram hoje! 🔥' : f.friendToday ? `${f.name} já marcou. Falta você!` : f.meToday ? `Você marcou. Falta ${f.name}.` : 'Ninguém marcou hoje ainda.'}
                  {f.restUsed && ' · descanso usado'}
                </p>
              </div>
              <button onClick={() => remove(f)} aria-label={`Apagar foguinho com ${f.name}`} className="p-1.5 text-white/25"><X size={14} /></button>
            </div>
            <div className="flex gap-2 text-[10px]">
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${f.meToday ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/35'}`}>{f.meToday && <Check size={10} />} Você</span>
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${f.friendToday ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/35'}`}>{f.friendToday && <Check size={10} />} {f.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['apoio', '💛 Apoio'], ['pensei', '🌊 Pensei'], ['parabens', '🎉 Parabéns']] as const).map(([k, l]) => (
                <button key={k} onClick={() => nudge(f, k)} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black">
                  {sent === `${f.pairId}:${k}` ? 'Enviado ✓' : l}
                </button>
              ))}
            </div>
            {!f.meToday && (
              <button onClick={() => router.push('/')} className="w-full py-3 rounded-2xl bg-orange-400 text-slate-950 text-[10px] font-black uppercase tracking-widest">Marcar meu dia</button>
            )}
          </section>
        ))}

        {state && state.friends.length < state.max && (
          <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3">
            <p className="text-sm font-black flex items-center gap-2"><UserPlus size={16} className="text-orange-300" /> {state.friends.length ? 'Acender com mais alguém' : 'Acenda seu primeiro foguinho'}</p>
            <button onClick={invite} disabled={busy} className="w-full py-3.5 rounded-2xl bg-orange-400 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Convidar um amigo
            </button>
            {myCode && <p className="text-xs text-white/60 font-semibold text-center">Seu código: <b className="text-orange-200 tracking-[0.3em] text-base" data-testid="meu-codigo">{myCode}</b> · vale 7 dias</p>}
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Tenho um código" className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm tracking-[0.2em] uppercase outline-none focus:border-orange-300/40 placeholder:text-white/25 placeholder:tracking-normal placeholder:normal-case" />
              <button onClick={join} disabled={busy || code.trim().length !== 6} className="px-4 rounded-2xl bg-white/10 border border-white/15 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest">Entrar</button>
            </div>
          </section>
        )}
        {msg && <p className="text-xs font-bold text-orange-100/80">{msg}</p>}

        <PenseiEmVoce from={user ? firstName(user, null, '') : ''} />

        <p className="flex items-start gap-2 text-[11px] text-white/35 font-semibold leading-relaxed"><Heart size={13} className="shrink-0 mt-0.5" /> O foguinho é para lembrar de se cuidar junto, não uma obrigação. Se um dia não der, tudo bem.</p>
      </div>
    </main>
  );
}
