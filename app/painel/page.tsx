"use client";

// Painel da instituição parceira (B2B): só números agregados e anônimos.
// Nada de conversas, Cofre, diário ou dados de uma pessoa. Abaixo de 5 pessoas ativas
// na semana, nenhum número aparece (para ninguém ser identificado).

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Loader2, Copy, Share2, RefreshCw, Settings, CalendarDays, Check, Trash2, ShieldCheck, Users, TrendingUp, TrendingDown, Minus, Lock, AlertTriangle, Lightbulb, Plus, X, Download, Layers, Sparkles, Megaphone, FileText, HeartPulse, Target, BellRing, UserX } from 'lucide-react';
import { noricaApi, type CampaignKind, type CarePerson, type OrgCampaign, type OrgDashboard, type OrgDetails, type OrgSector } from '@/lib/norica-api';
import { proximosExames, diasAte, type Exame } from '@/lib/vestibulares';
import { CAMPAIGN_TEMPLATES, nextWindow } from '@/lib/campanhas';
import { shareText } from '@/lib/share-text';
import { buildOrgReportPdf } from '@/lib/relatorio-instituicao';
import { shareFile } from '@/lib/share-file';
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

  const [tab, setTab] = useState<'grupo' | 'cuidado'>('grupo');
  const load = () => noricaApi.orgDashboard().then(setData).catch((err) => setError(err?.message || 'Não foi possível carregar o painel.'));
  useEffect(() => {
    load();
    // Veio do alerta da psicóloga: abre direto na aba Cuidado.
    if (new URLSearchParams(window.location.search).get('aba') === 'cuidado') setTab('cuidado');
  }, []);
  const isPsi = !!data?.info?.psi?.isPsi;
  // A psicóloga acompanha o cuidado; códigos, campanhas e ajustes ficam com a coordenação.
  const readOnly = isPsi && !data?.demo;

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
          <div className="space-y-3" aria-label="Carregando painel">
            <div className="grid grid-cols-2 gap-3"><div className="skeleton h-32 rounded-[2rem]" /><div className="skeleton h-32 rounded-[2rem]" /></div>
            <div className="skeleton h-48 rounded-[2.5rem]" />
            <div className="skeleton h-64 rounded-[2.5rem]" />
          </div>
        )}
        {error && <p className="text-sm font-bold text-rose-300">{error}</p>}

        {data && (
          <>
            {data.demo && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-500/10 border border-sky-400/25" data-testid="demo">
                <Sparkles size={16} className="text-sky-300 shrink-0 mt-0.5" />
                <p className="text-xs text-white/75 font-semibold leading-relaxed">
                  <b className="text-sky-200">Demonstração:</b> os números abaixo são fictícios, para mostrar como o painel funciona. Com uma instituição real, aparecem só dados somados e anônimos do grupo.
                </p>
              </div>
            )}
            {isPsi && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10" role="tablist">
                {([['grupo', 'Grupo', Users], ['cuidado', 'Cuidado', HeartPulse]] as const).map(([id, label, Icon]) => (
                  <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`aba-${id}`} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${tab === id ? (id === 'cuidado' ? 'bg-rose-400 text-slate-950' : 'bg-emerald-500 text-slate-950') : 'text-white/50'}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
            {isPsi && tab === 'cuidado' ? <Cuidado demo={!!data.demo} /> : (<>
            {data.info && <Convite info={data.info} org={data.org} demo={!!data.demo} members={data.members} onRenamed={load} />}
            {data.info && !readOnly && (data.info.kind === 'cursinho' || data.info.kind === 'escola') && <Vestibulares data={data} />}

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

            {(data.alerts.length > 0 || data.actions.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.alerts.length > 0 && (
                  <section className="bg-amber-400/5 border border-amber-300/20 rounded-[2.5rem] p-6 space-y-3" data-testid="alertas">
                    <h2 className="flex items-center gap-2 text-sm font-black text-amber-200 uppercase tracking-tighter"><AlertTriangle size={16} /> Pontos de atenção</h2>
                    <ul className="space-y-2">
                      {data.alerts.map((a) => <li key={a} className="text-[13px] text-white/80 font-semibold leading-snug">{a}</li>)}
                    </ul>
                  </section>
                )}
                {data.actions.length > 0 && (
                  <section className="bg-emerald-500/5 border border-emerald-400/20 rounded-[2.5rem] p-6 space-y-3">
                    <h2 className="flex items-center gap-2 text-sm font-black text-emerald-300 uppercase tracking-tighter"><Lightbulb size={16} /> Ações sugeridas</h2>
                    <ul className="space-y-2">
                      {data.actions.map((a) => <li key={a} className="text-[13px] text-white/80 font-semibold leading-snug">• {a}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            )}

            <Setores data={data} onChanged={load} readOnly={readOnly} />

            {!readOnly && <Campanhas data={data} />}

            <button onClick={() => buildOrgReportPdf(data).then((b) => shareFile(b, `norica-instituicao-${new Date().toLocaleDateString('en-CA')}.pdf`, 'Relatório da instituição')).catch(() => {})} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/80" data-testid="pdf-instituicao">
              <FileText size={16} className="text-emerald-300" /> Relatório da instituição (PDF)
            </button>

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
            </>)}
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

const LABELS = ['Setor', 'Turma', 'Equipe', 'Departamento', 'Unidade'];
const plural = (l: string) => (l === 'Setor' ? 'Setores' : `${l}s`);
const feminine = (l: string) => ['Turma', 'Equipe', 'Unidade'].includes(l);

function toCsv(d: OrgDashboard) {
  const head = [d.sectorLabel, 'Participantes', 'Ativos na semana', '% dia difícil', '% semana anterior', '% calmo', '% ansioso', '% agitado', '% S.O.S', '% cuidaram nos Logs', 'Assuntos'];
  // Aspas e "'" na frente de =, +, -, @: o Excel não executa nada que venha dos nomes de turma ou dos assuntos.
  const esc = (v: unknown) => { const t = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`; };
  const rows = [
    ['Geral', d.members, d.current?.active ?? '', d.current?.hardPeoplePct ?? '', d.previous?.hardPeoplePct ?? '', d.current?.moodPct.calmo ?? '', d.current?.moodPct.ansioso ?? '', d.current?.moodPct.agitado ?? '', d.current?.moodPct.sos ?? '', d.current?.logsPct ?? '', d.current?.topics.map((t) => t.topic).join('; ') ?? ''],
    ...d.sectors.map((r) => [r.name, r.members, r.current?.active ?? 'oculto', r.current?.hardPeoplePct ?? '', r.previous?.hardPeoplePct ?? '', r.current?.moodPct.calmo ?? '', r.current?.moodPct.ansioso ?? '', r.current?.moodPct.agitado ?? '', r.current?.moodPct.sos ?? '', r.current?.logsPct ?? '', r.current?.topics.map((t) => t.topic).join('; ') ?? '']),
  ];
  return '\uFEFF' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\n');
}

async function exportCsv(d: OrgDashboard) {
  const name = `norica-painel-${new Date().toLocaleDateString('en-CA')}.csv`;
  const csv = toCsv(d);
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
      const saved = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: 'Painel Nórica', url: saved.uri, dialogTitle: 'Exportar planilha' });
      return;
    }
  } catch (_e) {}
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Setores({ data, onChanged, readOnly = false }: { data: OrgDashboard; onChanged: () => void; readOnly?: boolean }) {
  const [list, setList] = useState<OrgSector[]>(data.sectorList);
  const [label, setLabel] = useState(data.sectorLabel || 'Setor');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  useEffect(() => { setList(data.sectorList); setLabel(data.sectorLabel || 'Setor'); }, [data]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); onChanged(); } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  };
  const add = () => run(async () => { const r = await noricaApi.orgSectorCreate(name.trim()); setList(r.sectors); setName(''); });
  const del = (id: string) => run(async () => { const r = await noricaApi.orgSectorDelete(id); setList(r.sectors); });
  const changeLabel = (l: string) => run(async () => { await noricaApi.orgSetLabel(l); setLabel(l); });

  const avg = data.current?.hardPeoplePct ?? null;

  return (
    <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-5" data-testid="setores">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-white uppercase tracking-tighter"><Layers size={16} className="text-sky-300" /> Por {label.toLowerCase()}</h2>
          <p className="text-[11px] text-white/45 font-semibold mt-1">Cada pessoa escolhe {feminine(label) ? 'a própria' : 'o próprio'} {label.toLowerCase()} no Perfil. Grupos com menos de {data.minGroup} pessoas ativas entram em &quot;Outros&quot;.</p>
        </div>
        <button onClick={() => exportCsv(data)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70">
          <Download size={12} /> CSV
        </button>
      </div>

      {data.sectors.length === 0 ? (
        <p className="text-sm text-white/50 font-semibold">
          {list.length === 0 ? `Crie ${plural(label).toLowerCase()} abaixo (ex.: Vendas, RH, Tecnologia ou 3º A, 3º B) para comparar como cada grupo está.` : `Ainda não há ${plural(label).toLowerCase()} com ${data.minGroup}+ pessoas ativas nesta semana.`}
        </p>
      ) : (
        <div className="space-y-3">
          {data.sectors.map((r) => {
            const c = r.current;
            const diff = c && r.previous ? c.hardPeoplePct - r.previous.hardPeoplePct : null;
            const above = c && avg !== null ? c.hardPeoplePct - avg : 0;
            return (
              <div key={r.id} className="p-4 rounded-2xl bg-black/25 border border-white/5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">{r.name}</span>
                  <span className="text-[10px] font-black text-white/45 uppercase tracking-widest">{c ? `${c.active} ativas` : 'oculto'} · {r.members} no total</span>
                </div>
                {c ? (
                  <>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5 gap-[2px]" role="img" aria-label={MOODS.map((m) => `${m.label} ${c.moodPct[m.key] ?? 0}%`).join(', ')}>
                      {MOODS.map((m) => (c.moodPct[m.key] ?? 0) > 0 && (
                        <div key={m.key} style={{ width: `${c.moodPct[m.key]}%`, background: MOOD_COLOR[m.key as keyof typeof MOOD_COLOR] }} />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Mini v={`${c.hardPeoplePct}%`} l="dia difícil" tone={above >= 15 ? 'warn' : undefined} sub={diff === null || diff === 0 ? undefined : `${diff > 0 ? '+' : ''}${diff} pts`} />
                      <Mini v={`${c.moodPct.ansioso ?? 0}%`} l="ansioso" />
                      <Mini v={`${c.logsPct}%`} l="nos Logs" />
                    </div>
                    {c.topics.length > 0 && <p className="text-[11px] text-white/50 font-semibold">Assuntos: <span className="capitalize">{c.topics.map((t) => t.topic).join(', ')}</span></p>}
                  </>
                ) : (
                  <p className="text-[11px] text-white/35 font-semibold">Menos de {data.minGroup} pessoas ativas nesta semana — números ocultos.</p>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3 pt-1">
            {MOODS.map((m) => (
              <span key={m.key} className="flex items-center gap-1.5 text-[10px] font-bold text-white/50">
                <span className="w-2 h-2 rounded-full" style={{ background: MOOD_COLOR[m.key as keyof typeof MOOD_COLOR] }} /> {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {!readOnly && <div className="border-t border-white/5 pt-4 space-y-3">
        <button onClick={() => setManage((v) => !v)} className="text-[10px] font-black uppercase tracking-widest text-sky-300">
          {manage ? 'Fechar' : `Gerenciar ${plural(label).toLowerCase()} (${list.length})`}
        </button>
        {manage && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {LABELS.map((l) => (
                <button key={l} disabled={busy} onClick={() => changeLabel(l)} className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${label === l ? 'bg-sky-500/20 border-sky-400/40 text-sky-200' : 'border-white/10 text-white/50'}`}>{l}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {list.map((sec) => (
                <span key={sec.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/80">
                  {sec.name}
                  <button disabled={busy} onClick={() => del(sec.id)} aria-label={`Remover ${sec.name}`} className="p-0.5 rounded-full text-white/40 hover:text-rose-300"><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={label === 'Turma' ? 'Ex.: 3º ano A' : 'Ex.: Vendas'} className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50 placeholder:text-white/25" />
              <button disabled={busy || !name.trim()} onClick={add} className="px-4 rounded-2xl bg-sky-400 text-slate-950 font-black disabled:opacity-40 flex items-center gap-1 text-[10px] uppercase tracking-widest">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
              </button>
            </div>
            {err && <p className="text-xs font-bold text-rose-300">{err}</p>}
          </div>
        )}
      </div>}
    </section>
  );
}

function Mini({ v, l, sub, tone }: { v: string; l: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className={`p-2 rounded-xl border ${tone === 'warn' ? 'bg-amber-400/10 border-amber-300/30' : 'bg-white/5 border-white/5'}`}>
      <p className="text-lg font-black text-white tabular-nums leading-none">{v}</p>
      <p className="text-[9px] font-black text-white/45 uppercase tracking-widest mt-1">{l}</p>
      {sub && <p className="text-[9px] font-bold text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const br = (iso: string) => iso.split('-').reverse().join('/');

function Campanhas({ data }: { data: OrgDashboard }) {
  const [list, setList] = useState<OrgCampaign[]>(data.campaigns ?? []);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CampaignKind>('provas');
  const [title, setTitle] = useState(CAMPAIGN_TEMPLATES.provas.title);
  const [message, setMessage] = useState(CAMPAIGN_TEMPLATES.provas.message);
  const [start, setStart] = useState(plusDays(0));
  const [end, setEnd] = useState(plusDays(6));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setList(data.campaigns ?? []); }, [data]);

  const pick = (k: CampaignKind) => {
    setKind(k);
    const t = CAMPAIGN_TEMPLATES[k];
    setTitle(t.title);
    setMessage(t.message);
    if (k === 'setembro') {
      // Setembro inteiro (deste ano, ou do próximo se setembro já passou).
      const now = new Date();
      const y = now.getMonth() > 8 ? now.getFullYear() + 1 : now.getFullYear();
      setStart(`${y}-09-01`); setEnd(`${y}-09-30`);
    } else {
      setStart(plusDays(0)); setEnd(plusDays(6));
    }
  };
  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await noricaApi.orgCampaignCreate({ kind, title: title.trim(), message: message.trim(), startsOn: start, endsOn: end });
      setList(r.campaigns); setOpen(false);
    } catch (e: any) { setErr(e?.message || 'Não foi possível criar.'); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { setList((await noricaApi.orgCampaignDelete(id)).campaigns); } catch (_e) {}
  };
  const today = plusDays(0);
  const orgKind = data.info?.kind ?? 'empresa';
  const ready = (Object.keys(CAMPAIGN_TEMPLATES) as CampaignKind[])
    .map((k) => ({ k, t: CAMPAIGN_TEMPLATES[k], w: nextWindow(CAMPAIGN_TEMPLATES[k]) }))
    .filter((x) => x.w && (!x.t.for || x.t.for.includes(orgKind)))
    .sort((a, b) => a.w!.start.localeCompare(b.w!.start));
  const scheduled = (k: CampaignKind, w: { start: string; end: string }) => list.some((c) => c.kind === k && c.ends_on >= w.start && c.starts_on <= w.end);
  const [activating, setActivating] = useState<string | null>(null);
  const activate = async (k: CampaignKind, w: { start: string; end: string }) => {
    setActivating(k); setErr(null);
    try {
      const t = CAMPAIGN_TEMPLATES[k];
      setList((await noricaApi.orgCampaignCreate({ kind: k, title: t.title, message: t.message, startsOn: w.start, endsOn: w.end })).campaigns);
    } catch (e: any) { setErr(e?.message || 'Não foi possível ativar.'); } finally { setActivating(null); }
  };

  return (
    <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4" data-testid="campanhas">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-white uppercase tracking-tighter"><Megaphone size={16} className="text-amber-300" /> Campanhas</h2>
          <p className="text-[11px] text-white/45 font-semibold mt-1">Uma mensagem com ação aparece na Início de todos do grupo durante o período.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest"><Plus size={12} /> Nova</button>}
      </div>

      {open && (
        <div className="space-y-3 p-4 rounded-2xl bg-black/25 border border-white/5">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CAMPAIGN_TEMPLATES) as CampaignKind[]).map((k) => (
              <button key={k} onClick={() => pick(k)} className={`px-3 py-1.5 rounded-full text-[11px] font-black border ${kind === k ? 'bg-amber-400/20 border-amber-300/40 text-amber-100' : 'border-white/10 text-white/50'}`}>{CAMPAIGN_TEMPLATES[k].emoji} {CAMPAIGN_TEMPLATES[k].label}</button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Título" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50 placeholder:text-white/25" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} rows={3} placeholder="Mensagem para o grupo" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50 placeholder:text-white/25 resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest space-y-1">De<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white [color-scheme:dark]" /></label>
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest space-y-1">Até<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white [color-scheme:dark]" /></label>
          </div>
          {err && <p className="text-xs font-bold text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={busy || !title.trim() || !message.trim()} className="flex-1 py-3 rounded-2xl bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />} Publicar campanha</button>
            <button onClick={() => setOpen(false)} className="px-4 rounded-2xl border border-white/10 text-white/50 text-[10px] font-black uppercase">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-2" data-testid="calendario-campanhas">
        <p className="flex items-center gap-1.5 text-[10px] font-black text-white/40 uppercase tracking-widest"><CalendarDays size={12} /> Calendário pronto · ative com um toque</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 pb-1">
          {ready.map(({ k, t, w }) => {
            const on = scheduled(k, w!);
            return (
              <div key={k} className="shrink-0 w-44 p-3 rounded-2xl bg-black/25 border border-white/5 space-y-2">
                <p className="text-lg leading-none">{t.emoji}</p>
                <p className="text-[12px] font-black text-white leading-tight">{t.label}</p>
                <p className="text-[10px] font-bold text-white/40">{br(w!.start)} a {br(w!.end)}</p>
                <button onClick={() => activate(k, w!)} disabled={on || activating === k} className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 ${on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-400 text-slate-950'}`} data-testid={`ativar-${k}`}>
                  {activating === k ? <Loader2 size={11} className="animate-spin" /> : on ? <><Check size={11} /> Agendada</> : 'Ativar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        !open && <p className="text-sm text-white/45 font-semibold">Nenhuma campanha ainda. Ative uma do calendário ou crie a sua em "Nova".</p>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => {
            const live = c.starts_on <= today && c.ends_on >= today;
            return (
              <li key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-black/25 border border-white/5">
                <span className="text-xl">{CAMPAIGN_TEMPLATES[c.kind]?.emoji ?? '📣'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{c.title}</p>
                  <p className="text-[10px] font-bold text-white/40">{br(c.starts_on)} a {br(c.ends_on)} · <span className={live ? 'text-emerald-300' : 'text-white/40'}>{live ? 'no ar' : c.starts_on > today ? 'agendada' : 'encerrada'}</span></p>
                </div>
                <button onClick={() => remove(c.id)} aria-label={`Remover ${c.title}`} className="p-1 text-white/30"><X size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}


function Convite({ info: initial, org, demo, members, onRenamed }: { info: OrgDetails; org: string; demo: boolean; members: number; onRenamed: () => void }) {
  const router = useRouter();
  const [info, setInfo] = useState(initial);
  const [copied, setCopied] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState(org);
  const [busy, setBusy] = useState(false);
  useEffect(() => setInfo(initial), [initial]);
  const people = info.kind === 'escola' || info.kind === 'cursinho' ? 'alunos' : info.kind === 'empresa' ? 'funcionários' : 'participantes';
  const invite = `${org} agora tem a Nórica, um app de apoio emocional 💚\n\n1. Baixe: https://play.google.com/store/apps/details?id=com.zcx.ancora\n2. Em Perfil → Instituição Parceira, digite o código: ${info.code}\n\nA instituição vê só números somados do grupo, nunca o que você escreve ou sente.`;
  const copy = async (text: string, k: string) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(null), 2000); } catch (_e) {} };
  const trial = info.plan === 'teste' && info.trialUntil ? Math.max(0, Math.round((Date.parse(`${info.trialUntil}T12:00:00`) - Date.parse(`${new Date().toLocaleDateString('en-CA')}T12:00:00`)) / 86400_000)) : null;
  const newCode = async (team: boolean) => {
    if (!window.confirm(team ? 'Gerar um novo código da equipe? O antigo para de funcionar.' : `Gerar um novo código para ${people}? Quem já entrou continua; o código antigo para de funcionar.`)) return;
    setBusy(true); try { setInfo((await noricaApi.orgNewCode(team)).info); } catch (_e) {} finally { setBusy(false); }
  };
  const rename = async () => { setBusy(true); try { await noricaApi.orgRename(name.trim()); onRenamed(); setSettings(false); } catch (_e) {} finally { setBusy(false); } };
  const remove = async () => {
    if (!window.confirm(`Apagar ${org}? O painel, os setores e as campanhas somem. Os dados pessoais de cada um continuam só com cada um.`)) return;
    setBusy(true); try { await noricaApi.orgDelete(); router.replace('/perfil/'); } catch (_e) { setBusy(false); }
  };

  return (
    <section className="p-6 rounded-[2.5rem] bg-gradient-to-br from-amber-950/40 to-white/[0.03] border border-amber-300/20 space-y-4" data-testid="convite-instituicao">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-tighter">Convide o grupo</h2>
          <p className="text-[11px] text-white/50 font-semibold mt-1">{members} {members === 1 ? 'pessoa entrou' : 'pessoas entraram'} com o código.{members < 5 && ' Os números aparecem a partir de 5 pessoas ativas.'}</p>
        </div>
        {trial !== null && !demo && <span className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-widest" data-testid="teste-gratis">Teste · {trial} {trial === 1 ? 'dia' : 'dias'}</span>}
        {info.plan === 'ativo' && <span className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-widest">Plano ativo</span>}
      </div>
      <div className="p-4 rounded-2xl bg-black/30 border border-white/10 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Código para {people}</p>
          <p className="text-xl font-black tracking-[0.12em] text-amber-200 break-all leading-tight" data-testid="codigo-instituicao">{info.code}</p>
        </div>
        <button onClick={() => copy(info.code ?? '', 'code')} className="shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center" aria-label="Copiar código">{copied === 'code' ? <Check size={15} /> : <Copy size={15} />}</button>
      </div>
      {!demo && (
        <button onClick={() => shareText(invite, `Nórica na ${org}`)} className="w-full py-3.5 rounded-2xl bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Share2 size={14} /> Enviar convite pronto</button>
      )}
      {info.adminCode && (
        <div className="flex items-center gap-3 text-[12px] text-white/55 font-semibold">
          <p className="flex-1 min-w-0 break-words">Código da <b className="text-white/80">equipe</b> (coordenação, RH): <b className="text-white/80 tracking-wider break-all">{info.adminCode}</b> — quem entra com ele vê o painel.</p>
          <button onClick={() => copy(info.adminCode ?? '', 'team')} className="shrink-0 w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/60 flex items-center justify-center" aria-label="Copiar código da equipe">{copied === 'team' ? <Check size={14} /> : <Copy size={14} />}</button>
        </div>
      )}
      {!demo && !info.psi?.isPsi && (
        <>
          <button onClick={() => setSettings((v) => !v)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40"><Settings size={12} /> Ajustes</button>
          {settings && (
            <div className="space-y-3 p-4 rounded-2xl bg-black/25 border border-white/5">
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none" aria-label="Nome da instituição" />
                <button onClick={rename} disabled={busy || name.trim().length < 3} className="px-3 rounded-xl bg-white/10 text-white/80 text-[10px] font-black uppercase disabled:opacity-40">Salvar</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => newCode(false)} disabled={busy} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/75 text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><RefreshCw size={11} /> Novo código</button>
                <button onClick={() => newCode(true)} disabled={busy} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/75 text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><RefreshCw size={11} /> Novo da equipe</button>
              </div>
              {!info.psi?.isPsi && <PsiSetup info={info} people={people} onChange={setInfo} />}
              {info.owner && <button onClick={remove} disabled={busy} className="w-full py-2.5 rounded-xl text-rose-300/80 text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><Trash2 size={11} /> Apagar instituição</button>}
            </div>
          )}
        </>
      )}
    </section>
  );
}


// ---------------------------------------------------------------------
// Psicóloga da instituição: ligar o acompanhamento (equipe) e a aba Cuidado (psicóloga)
// ---------------------------------------------------------------------

function PsiSetup({ info, people, onChange }: { info: OrgDetails; people: string; onChange: (i: OrgDetails) => void }) {
  const psi = info.psi;
  const school = info.kind === 'escola' || info.kind === 'cursinho';
  const [guardian, setGuardian] = useState(!!psi?.guardianOk);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = async (enabled: boolean, newCode = false) => {
    setBusy(true); setErr(null);
    try { onChange((await noricaApi.orgPsiSetup(enabled, guardian, newCode)).info); } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-rose-400/5 border border-rose-300/20" data-testid="psi-setup">
      <p className="flex items-center gap-2 text-[11px] font-black text-rose-200 uppercase tracking-widest"><HeartPulse size={13} /> Acompanhamento pela psicóloga</p>
      <p className="text-[12px] text-white/60 font-semibold leading-relaxed">
        A psicóloga da instituição entra com um código próprio e vê <b className="text-white/80">só o humor dos últimos 14 dias</b> de quem escolher compartilhar no Perfil — nunca conversas, diário ou Cofre. Ela recebe um aviso (sem nome) quando alguém que compartilha toca no S.O.S.
      </p>
      {psi?.enabled ? (
        <>
          <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Código da psicóloga</p>
              <p className="text-base font-black tracking-[0.06em] text-rose-200 break-all" data-testid="codigo-psi">{psi.code}</p>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(psi.code ?? '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }} className="shrink-0 w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/60 flex items-center justify-center" aria-label="Copiar código da psicóloga">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
          <p className="text-[11px] text-white/50 font-semibold">{psi.psychologists} psicóloga(s) · <b className="text-white/75">{psi.sharing}</b> {people} compartilhando</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => run(true, true)} disabled={busy} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/75 text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><RefreshCw size={11} /> Novo código</button>
            <button onClick={() => { if (window.confirm('Desligar o acompanhamento? Todos param de compartilhar e precisarão ligar de novo.')) run(false); }} disabled={busy} className="py-2.5 rounded-xl text-rose-300/80 border border-rose-300/20 text-[10px] font-black uppercase" data-testid="psi-desligar">Desligar</button>
          </div>
        </>
      ) : (
        <>
          {school && (
            <label className="flex items-start gap-3 text-[12px] text-white/65 font-semibold leading-snug">
              <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="mt-0.5 accent-rose-400 w-4 h-4 shrink-0" data-testid="psi-responsaveis" />
              <span>A instituição tem a <b className="text-white/85">autorização por escrito dos responsáveis</b> pelos alunos menores de 18 anos para este acompanhamento.</span>
            </label>
          )}
          <button onClick={() => run(true)} disabled={busy || (school && !guardian)} className="w-full py-3 rounded-xl bg-rose-400 text-slate-950 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2" data-testid="psi-ligar">
            {busy && <Loader2 size={13} className="animate-spin" />} Ligar e gerar código da psicóloga
          </button>
        </>
      )}
      {err && <p className="text-xs font-bold text-rose-300">{err}</p>}
    </div>
  );
}

const FLAG: Record<string, { label: string; cls: string; icon: any }> = {
  sos: { label: 'Tocou no S.O.S', cls: 'bg-rose-500/15 border-rose-400/40 text-rose-200', icon: BellRing },
  dificil: { label: 'Semana difícil', cls: 'bg-amber-400/10 border-amber-300/35 text-amber-200', icon: AlertTriangle },
  sumiu: { label: 'Sem registro há dias', cls: 'bg-white/5 border-white/15 text-white/60', icon: UserX },
};

function Cuidado({ demo }: { demo: boolean }) {
  const [people, setPeople] = useState<CarePerson[] | null>(null);
  const [notSharing, setNotSharing] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'atencao' | 'todos'>('atencao');
  useEffect(() => {
    noricaApi.orgCareList().then((r) => { setPeople(r.people); setNotSharing(r.notSharing); }).catch((e) => setErr(e?.message || 'Não foi possível carregar.'));
  }, []);
  const flagged = (people ?? []).filter((p) => p.flag);
  const shown = filter === 'atencao' ? flagged : people ?? [];

  return (
    <section className="space-y-5" data-testid="cuidado">
      <div className="p-5 rounded-[2rem] bg-gradient-to-br from-rose-950/50 to-white/[0.03] border border-rose-300/20 space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-black text-white uppercase tracking-tighter"><HeartPulse size={16} className="text-rose-300" /> Quem pediu para você acompanhar</h2>
        <p className="text-[12px] text-white/60 font-semibold leading-relaxed">
          Aparece só quem ligou &quot;Compartilhar meu humor com a psicóloga&quot; no Perfil. Você vê o humor dos últimos 14 dias — nunca conversas, diário ou Cofre. Cada acesso fica registrado.
        </p>
        {demo && <p className="text-[11px] text-sky-200 font-bold">Demonstração: nomes e dados fictícios.</p>}
      </div>

      {!people && !err && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>}
      {err && <p className="text-sm font-bold text-rose-300">{err}</p>}

      {people && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Mini v={String(people.length)} l="compartilham" />
            <Mini v={String(flagged.length)} l="pedem atenção" tone={flagged.length ? 'warn' : undefined} />
            <Mini v={String(notSharing)} l="não compartilham" />
          </div>
          <div className="flex gap-2">
            {([['atencao', `Pedem atenção (${flagged.length})`], ['todos', `Todos (${people.length})`]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-full text-[11px] font-black border ${filter === id ? 'bg-rose-400/20 border-rose-300/40 text-rose-100' : 'border-white/10 text-white/50'}`}>{l}</button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-white/55 font-semibold p-5 rounded-2xl bg-white/5 border border-white/10">
              {people.length === 0 ? 'Ninguém está compartilhando ainda. Explique para a turma como ligar no Perfil → Instituição — é sempre escolha de cada um.' : 'Ninguém com sinal de atenção agora. 💚'}
            </p>
          ) : (
            <ul className="space-y-2">
              {shown.map((p) => {
                const f = p.flag ? FLAG[p.flag] : null;
                return (
                  <li key={p.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3" data-testid="cuidado-pessoa">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">{p.name}</p>
                        <p className="text-[10px] font-bold text-white/40">{p.sector ?? 'Sem turma'} · {p.lastDay ? (p.daysAway === 0 ? 'registrou hoje' : `último registro há ${p.daysAway} dia(s)`) : 'sem registros'}</p>
                      </div>
                      {f && <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${f.cls}`}><f.icon size={11} /> {f.label}</span>}
                    </div>
                    <div className="flex gap-[3px]" role="img" aria-label={`Humor dos últimos 14 dias de ${p.name}`}>
                      {p.series.map((d) => (
                        <span key={d.day} title={`${br(d.day)}: ${d.mood ?? 'sem registro'}`} className="flex-1 h-3 rounded-[3px]" style={{ background: d.mood ? MOOD_COLOR[d.mood as keyof typeof MOOD_COLOR] : 'rgba(255,255,255,0.07)' }} />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            {MOODS.map((m) => (
              <span key={m.key} className="flex items-center gap-1.5 text-[10px] font-bold text-white/50">
                <span className="w-2 h-2 rounded-full" style={{ background: MOOD_COLOR[m.key as keyof typeof MOOD_COLOR] }} /> {m.label}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/40 font-semibold leading-relaxed">
            Use para oferecer uma conversa, nunca para cobrar ou expor. Em risco imediato, siga o protocolo da instituição e acione os responsáveis, o CVV (188) ou o SAMU (192).
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Cursinho / escola: provas com data exata e campanhas de um toque
// ---------------------------------------------------------------------

const shift = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
function examCampaigns(e: Exame): { kind: CampaignKind; start: string; end: string; label: string }[] {
  if (e.id === 'enem26-1') return [
    { kind: 'enem', start: shift(e.dia, -14), end: shift(e.dia, -2), label: 'Reta final' },
    { kind: 'vesperaenem', start: shift(e.dia, -1), end: e.dia, label: 'Véspera' },
  ];
  if (e.id === 'enem26-2') return [{ kind: 'vesperaenem', start: shift(e.dia, -1), end: e.dia, label: 'Véspera' }];
  if (e.id === 'etec27-r') return [{ kind: 'resultado', start: e.dia, end: shift(e.dia, 6), label: 'Resultado' }];
  if (e.tipo === 'etec') return [{ kind: 'etec', start: shift(e.dia, -14), end: e.dia, label: 'Reta final' }];
  return [];
}

function Vestibulares({ data }: { data: OrgDashboard }) {
  const [list, setList] = useState<OrgCampaign[]>(data.campaigns ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setList(data.campaigns ?? []); }, [data]);
  const exams = proximosExames().slice(0, 4);
  if (!exams.length) return null;
  const today = plusDays(0);
  const on = (k: CampaignKind, start: string, end: string) => list.some((c) => c.kind === k && c.ends_on >= start && c.starts_on <= end);
  const activate = async (k: CampaignKind, start: string, end: string) => {
    setBusy(`${k}${start}`);
    try {
      const t = CAMPAIGN_TEMPLATES[k];
      setList((await noricaApi.orgCampaignCreate({ kind: k, title: t.title, message: t.message, startsOn: start < today ? today : start, endsOn: end })).campaigns);
    } catch (_e) {} finally { setBusy(null); }
  };
  return (
    <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4" data-testid="vestibulares">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-black text-white uppercase tracking-tighter"><Target size={16} className="text-violet-300" /> Provas que vêm aí</h2>
        <p className="text-[11px] text-white/45 font-semibold mt-1">Ative o apoio certo para cada fase: reta final, véspera e resultado. Os alunos veem na Início.</p>
      </div>
      <ul className="space-y-2">
        {exams.map((e) => {
          const n = diasAte(e.dia);
          return (
            <li key={e.id} className="p-4 rounded-2xl bg-black/25 border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0 text-center">
                  <p className="text-2xl font-black text-violet-200 tabular-nums leading-none">{n}</p>
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mt-1">{n === 1 ? 'dia' : 'dias'}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">{e.nome}</p>
                  <p className="text-[10px] font-bold text-white/45">{br(e.dia)}{e.hora ? ` · ${e.hora}` : ''} · {e.detalhe}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {examCampaigns(e).filter((c) => c.end >= today).map((c) => {
                  const done = on(c.kind, c.start, c.end);
                  return (
                    <button key={c.kind + c.start} onClick={() => activate(c.kind, c.start, c.end)} disabled={done || busy === `${c.kind}${c.start}`} data-testid={`vest-${c.kind}`} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-violet-400 text-slate-950'}`}>
                      {busy === `${c.kind}${c.start}` ? <Loader2 size={11} className="animate-spin" /> : done ? <Check size={11} /> : <Megaphone size={11} />} {CAMPAIGN_TEMPLATES[c.kind].emoji} {c.label} · {c.start <= today ? 'desde hoje' : br(c.start).slice(0, 5)}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-white/35 font-semibold">Datas oficiais divulgadas (Inep e Centro Paula Souza). Confira sempre os sites oficiais.</p>
    </section>
  );
}
