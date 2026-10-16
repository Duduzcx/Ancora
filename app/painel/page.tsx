"use client";

// Painel da instituição parceira (B2B): só números agregados e anônimos.
// Nada de conversas, Cofre, diário ou dados de uma pessoa. Abaixo de 5 pessoas ativas
// na semana, nenhum número aparece (para ninguém ser identificado).

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Loader2, ShieldCheck, Users, TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react';
import { noricaApi, type OrgDashboard, type OrgWeek } from '@/lib/norica-api';
import { MOOD_COLOR } from '@/lib/farol';

const MOODS: { key: string; label: string }[] = [
  { key: 'calmo', label: 'Calmo' },
  { key: 'ansioso', label: 'Ansioso' },
  { key: 'agitado', label: 'Agitado' },
  { key: 'sos', label: 'S.O.S' },
];

export default function PainelPage() {
  const router = useRouter();
  const [data, setData] = useState<OrgDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    noricaApi.orgDashboard().then(setData).catch((err) => setError(err?.message || 'Não foi possível carregar o painel.'));
  }, []);

  const cur = data?.current ?? null;
  const prev = data?.previous ?? null;

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-40 bg-[#020617]">
      <div className="relative z-10 max-w-3xl mx-auto p-6 pt-[calc(env(safe-area-inset-top,44px)+2rem)] space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white shadow-sm active:scale-95" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Dados anônimos</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Building2 size={26} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
            {data?.org ?? 'Painel'} <span className="text-emerald-400 italic">— bem-estar.</span>
          </h1>
          <p className="text-white/55 font-bold text-sm leading-relaxed">
            Como o grupo está, em números somados. Ninguém é identificado: conversas, Cofre e diários nunca aparecem aqui.
          </p>
        </div>

        {!data && !error && (
          <div className="flex items-center justify-center gap-3 text-white/50 text-sm font-bold py-10">
            <Loader2 size={18} className="animate-spin" /> Carregando…
          </div>
        )}
        {error && <p className="text-sm font-bold text-rose-300">{error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Participantes" value={String(data.members)} hint="com o código da instituição" icon={Users} />
              <Tile label="Ativos na semana" value={cur ? String(cur.active) : '—'} hint={prev ? `semana anterior: ${prev.active}` : 'últimos 7 dias'} icon={TrendingUp} />
            </div>

            {!cur ? (
              <div className="flex items-start gap-3 p-6 rounded-[2rem] bg-white/5 border border-white/10">
                <Lock size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-white/70 font-semibold leading-relaxed">
                  Os números aparecem quando pelo menos <b className="text-white">{data.minGroup} pessoas</b> usarem o app na semana. Isso protege o anonimato de todos.
                </p>
              </div>
            ) : (
              <>
                <Card title="Como o grupo marcou o próprio mar" subtitle="Porcentagem das marcações de humor nos últimos 7 dias">
                  <div className="space-y-3">
                    {MOODS.map((m) => (
                      <div key={m.key} className="grid grid-cols-[72px_1fr_44px] items-center gap-3">
                        <span className="text-xs font-black text-white/80">{m.label}</span>
                        <div className="h-3 rounded-full bg-white/5 overflow-hidden" role="img" aria-label={`${m.label}: ${cur.moodPct[m.key] ?? 0}%`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cur.moodPct[m.key] ?? 0}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: MOOD_COLOR[m.key as keyof typeof MOOD_COLOR] }}
                          />
                        </div>
                        <span className="text-xs font-black text-white/70 text-right tabular-nums">{cur.moodPct[m.key] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Stat
                    label="Tiveram algum dia difícil"
                    value={cur.hardPeoplePct}
                    prev={prev?.hardPeoplePct ?? null}
                    goodWhenDown
                    hint="marcaram ansioso, agitado ou S.O.S pelo menos uma vez"
                  />
                  <Stat label="Cuidaram de si nos Logs" value={cur.logsPct} prev={prev?.logsPct ?? null} hint="marcaram pelo menos um hábito na semana" />
                </div>

                <Card title="Assuntos mais presentes" subtitle="Só aparecem temas citados por 3 pessoas ou mais">
                  {cur.topics.length ? (
                    <ul className="space-y-2">
                      {cur.topics.map((t) => (
                        <li key={t.topic} className="flex items-center justify-between text-sm">
                          <span className="font-bold text-white/80 capitalize">{t.topic}</span>
                          <span className="font-black text-white/60 tabular-nums">{t.pct}% das pessoas</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-white/50 font-semibold">Nenhum tema em comum suficiente nesta semana.</p>
                  )}
                </Card>
              </>
            )}

            <Card title="Últimas 4 semanas" subtitle="Pessoas ativas e quantas tiveram algum dia difícil">
              <div className="space-y-3">
                {data.weeks.map((w) => (
                  <div key={w.label} className="grid grid-cols-[96px_1fr] items-center gap-3">
                    <span className="text-[11px] font-black text-white/60">{w.label}</span>
                    {w.active === null ? (
                      <span className="text-[11px] text-white/35 font-semibold">menos de {data.minGroup} pessoas — oculto</span>
                    ) : (
                      <span className="text-[12px] text-white/80 font-bold">
                        {w.active} ativas · <span className="text-amber-300">{w.hardPeoplePct}%</span> com dia difícil
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <p className="text-[11px] text-white/40 font-semibold leading-relaxed">
              Use estes números para planejar ações coletivas (rodas de conversa, semanas mais leves perto de provas, divulgar o CVV 188). Eles não servem para acompanhar pessoas individualmente.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4">
      <div>
        <h2 className="text-sm font-black text-white uppercase tracking-tighter">{title}</h2>
        <p className="text-[11px] text-white/45 font-semibold mt-1">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: any }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
      <Icon size={16} className="text-emerald-400 mb-3" />
      <p className="text-3xl font-black text-white tracking-tighter tabular-nums">{value}</p>
      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">{label}</p>
      <p className="text-[10px] text-white/35 font-semibold mt-1">{hint}</p>
    </div>
  );
}

function Stat({ label, value, prev, hint, goodWhenDown = false }: { label: string; value: number; prev: number | null; hint: string; goodWhenDown?: boolean }) {
  const diff = prev === null ? null : value - prev;
  const better = diff === null || diff === 0 ? null : goodWhenDown ? diff < 0 : diff > 0;
  const Icon = diff === null || diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
      <p className="text-3xl font-black text-white tracking-tighter tabular-nums">{value}%</p>
      <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">{label}</p>
      <p className="text-[10px] text-white/40 font-semibold mt-1">{hint}</p>
      {diff !== null && (
        <p className={`flex items-center gap-1 text-[10px] font-black mt-2 ${better === null ? 'text-white/40' : better ? 'text-emerald-300' : 'text-amber-300'}`}>
          <Icon size={12} /> {diff === 0 ? 'igual à semana anterior' : `${diff > 0 ? '+' : ''}${diff} pontos vs. semana anterior`}
        </p>
      )}
    </div>
  );
}
