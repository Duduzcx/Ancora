"use client";

// Criar a instituição (escola, cursinho ou empresa) direto pelo app.
// Quem cria vira a equipe: recebe o código para alunos/funcionários e o painel com números anônimos.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, GraduationCap, Briefcase, Users, Loader2, ShieldCheck, Check } from 'lucide-react';
import { noricaApi, type OrgKind } from '@/lib/norica-api';
import { cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';

const KINDS: { id: OrgKind; label: string; hint: string; icon: any }[] = [
  { id: 'escola', label: 'Escola ou cursinho', hint: 'Grupos por turma', icon: GraduationCap },
  { id: 'empresa', label: 'Empresa', hint: 'Grupos por setor', icon: Briefcase },
  { id: 'outro', label: 'Outro', hint: 'ONG, igreja, clube…', icon: Users },
];

export default function CriarInstituicaoPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<OrgKind>('escola');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await noricaApi.orgCreate(name.trim(), kind);
      cacheSet(getAuthState().user?.id, 'org', r);
      router.replace('/painel/?nova=1');
    } catch (e: any) { setErr(e?.message || 'Não foi possível criar agora.'); setBusy(false); }
  };

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-24 text-white" data-testid="criar-instituicao-pagina">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-7">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-amber-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-amber-200/80 uppercase tracking-[0.25em]">Para instituições</span>
        </div>

        <div className="space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center"><Building2 size={26} /></div>
          <h1 className="text-4xl font-black tracking-tighter leading-none">Cuidar do grupo <span className="text-amber-300 italic">sem expor ninguém.</span></h1>
          <p className="text-sm text-white/60 font-semibold leading-relaxed">Crie sua instituição, passe o código para alunos ou funcionários e acompanhe o bem-estar do grupo em números somados. <b className="text-white/80">30 dias grátis</b>, sem cartão.</p>
        </div>

        <ul className="space-y-2">
          {['Painel com humor, temas que pesam e alertas por turma ou setor', 'Campanhas prontas (Setembro Amarelo, provas, sono…) com um toque', 'Relatório mensal em PDF para a direção ou o RH'].map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13px] text-white/75 font-semibold"><Check size={15} className="text-emerald-300 shrink-0 mt-0.5" /> {t}</li>
          ))}
        </ul>

        <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Nome da instituição</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Colégio Horizonte" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-amber-300/50 placeholder:text-white/25" data-testid="nome-instituicao" />
          </label>
          <div className="space-y-2">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Tipo</span>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className={`p-3 rounded-2xl border text-center space-y-1 ${kind === k.id ? 'bg-amber-400/15 border-amber-300/40 text-amber-100' : 'bg-black/20 border-white/10 text-white/60'}`}>
                  <k.icon size={18} className="mx-auto" />
                  <p className="text-[11px] font-black leading-tight">{k.label}</p>
                  <p className="text-[9px] font-semibold opacity-60">{k.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-3 text-[12px] text-white/60 font-semibold leading-snug">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-amber-400 w-4 h-4 shrink-0" />
            <span>Sou responsável pela instituição e entendo que o painel mostra só números somados de grupos com 5 pessoas ou mais — nunca conversas, diário ou o humor de alguém.</span>
          </label>
          {err && <p className="text-xs font-bold text-rose-300">{err}</p>}
          <button onClick={create} disabled={busy || name.trim().length < 3 || !agree} className="w-full py-4 rounded-2xl bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2" data-testid="confirmar-criar">
            {busy && <Loader2 size={14} className="animate-spin" />} Criar e abrir o painel
          </button>
        </section>

        <p className="flex items-start gap-2 text-[11px] text-white/40 font-semibold leading-relaxed"><ShieldCheck size={13} className="shrink-0 mt-0.5" /> Depois do teste, a gente conversa sobre o plano da instituição. Nada é cobrado automaticamente.</p>
      </div>
    </main>
  );
}
