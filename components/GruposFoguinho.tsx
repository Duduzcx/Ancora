"use client";

// Foguinho de grupo (3 a 6 pessoas): a chama do grupo cresce nos dias em que
// a maioria (60%) marca o dia. Ninguém vê o que o outro escreveu ou sentiu.

import React, { useEffect, useState } from 'react';
import { Flame, Users, Loader2, Check, LogOut, Share2 } from 'lucide-react';
import { noricaApi, type CareGroup } from '@/lib/norica-api';
import { getAuthState } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { shareText, STORE_URL } from '@/lib/share-text';

export default function GruposFoguinho() {
  const uid = getAuthState().user?.id;
  const [groups, setGroups] = useState<CareGroup[] | null>(() => cacheGet<CareGroup[]>(uid, 'groups'));
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const apply = (r: { groups: CareGroup[] }) => { if (!Array.isArray(r?.groups)) return; setGroups(r.groups); cacheSet(uid, 'groups', r.groups); };
  useEffect(() => { noricaApi.groupsList().then(apply).catch(() => setGroups((g) => g ?? [])); }, []);

  const run = async (fn: () => Promise<{ groups: CareGroup[] }>, ok?: string) => {
    setBusy(true); setMsg(null);
    try { apply(await fn()); if (ok) setMsg(ok); return true; } catch (e: any) { setMsg(e?.message || 'Não foi possível agora.'); return false; } finally { setBusy(false); }
  };
  const share = (g: CareGroup) => shareText(`Entra no nosso foguinho de grupo "${g.name}" na Nórica? 🔥 A chama cresce quando a maioria marca o dia.\n\nCódigo do grupo: ${g.code}\n${STORE_URL}`, 'Foguinho de grupo');
  const create = async () => {
    const created = await run(() => noricaApi.groupsCreate(name.trim()), 'Grupo criado! Mande o código para a galera 🔥');
    if (created) setName('');
  };
  const join = async () => { if (await run(() => noricaApi.groupsJoin(code), 'Você entrou no grupo! 🔥')) setCode(''); };
  const leave = (g: CareGroup) => { if (window.confirm(`Sair do grupo ${g.name}?`)) run(() => noricaApi.groupsLeave(g.id)); };

  return (
    <section className="space-y-3" data-testid="grupos">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-200/70 flex items-center gap-2"><Users size={13} /> Foguinho de grupo</p>

      {groups?.map((g) => (
        <div key={g.id} className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3" data-testid="grupo">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${g.streak > 0 ? 'bg-orange-500/15' : 'bg-white/5'}`}>
              <Flame size={26} className={g.streak > 0 ? 'text-orange-400 flame-flicker' : 'text-white/25'} fill={g.streak > 0 ? 'currentColor' : 'none'} />
              <span className={`text-sm font-black tabular-nums ${g.streak > 0 ? 'text-orange-200' : 'text-white/40'}`}>{g.streak}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black truncate">{g.name}</p>
              <p className="text-[11px] text-white/50 font-semibold">
                {g.litToday ? 'A chama do grupo acendeu hoje! 🔥' : `Faltam ${Math.max(0, g.need - g.members.filter((m) => m.today).length)} para acender hoje`}
                {g.restUsed && ' · descanso usado'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.members.map((m, i) => (
              <span key={i} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${m.today ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/35'}`}>{m.today && <Check size={10} />} {m.name}</span>
            ))}
          </div>
          <div className="flex gap-2">
            {g.members.length < 6 && (
              <button onClick={() => share(g)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Share2 size={12} /> Convidar · {g.code}</button>
            )}
            <button onClick={() => leave(g)} className="px-4 py-2.5 rounded-xl text-white/35 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" aria-label={`Sair do grupo ${g.name}`}><LogOut size={12} /> Sair</button>
          </div>
        </div>
      ))}

      {groups && groups.length < 3 && (
        <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3">
          <p className="text-[12px] text-white/55 font-semibold leading-snug">De 3 a 6 pessoas. A chama do grupo cresce nos dias em que a maioria marca o dia.</p>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nome do grupo (ex.: Turma do 3º)" className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-300/40 placeholder:text-white/25" />
            <button onClick={create} disabled={busy || !name.trim()} className="px-4 rounded-2xl bg-orange-400 text-slate-950 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest">{busy ? <Loader2 size={14} className="animate-spin" /> : 'Criar'}</button>
          </div>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Código do grupo" className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm tracking-[0.2em] uppercase outline-none focus:border-orange-300/40 placeholder:text-white/25 placeholder:tracking-normal placeholder:normal-case" />
            <button onClick={join} disabled={busy || code.trim().length !== 6} className="px-4 rounded-2xl bg-white/10 border border-white/15 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest">Entrar</button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs font-bold text-orange-100/80">{msg}</p>}
    </section>
  );
}
