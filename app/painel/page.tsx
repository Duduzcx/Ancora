"use client";

// Painel da instituição parceira (B2B): só números agregados e anônimos.
// Nada de conversas, Cofre, diário ou dados de uma pessoa. Abaixo de 5 pessoas ativas
// na semana, nenhum número aparece (para ninguém ser identificado).

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Loader2, ShieldCheck, Users, TrendingUp, TrendingDown, Minus, Lock, AlertTriangle, Lightbulb, Plus, X, Download, Layers, Sparkles, Megaphone, FileText } from 'lucide-react';
import { noricaApi, type CampaignKind, type OrgCampaign, type OrgDashboard, type OrgSector } from '@/lib/norica-api';
import { CAMPAIGN_TEMPLATES } from '@/lib/campanhas';
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

  const load = () => noricaApi.orgDashboard().then(setData).catch((err) => setError(err?.message || 'Não foi possível carregar o painel.'));
  useEffect(() => { load(); }, []);

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

            <Setores data={data} onChanged={load} />

            <Campanhas data={data} />

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
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
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

function Setores({ data, onChanged }: { data: OrgDashboard; onChanged: () => void }) {
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

      <div className="border-t border-white/5 pt-4 space-y-3">
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
      </div>
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

      {list.length === 0 ? (
        !open && <p className="text-sm text-white/45 font-semibold">Nenhuma campanha. Experimente "Semana de provas" ou "Setembro Amarelo".</p>
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
