"use client";

// Plano de estudos: a pessoa diz o que precisa aprender e até quando; a Nórica monta um plano
// por dias, com passos, exercício, videoaulas do YouTube e cartões de revisão ao concluir cada dia.

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, Loader2, Map as MapIcon, Plus, Check, PlayCircle, ExternalLink, Trash2, Bell, ChevronDown, Sparkles } from 'lucide-react';
import { noricaApi, type PlanLevel, type PlanVideo, type StudyPlan } from '@/lib/norica-api';
import { planNext, planToday, getPlanReminder, setPlanReminder, refreshStudy, rememberPlans } from '@/lib/caderno';
import { cachedFaculdade, saveEvent, COLORS } from '@/lib/faculdade';
import { HelpSheet } from '@/components/AjudaAgora';

const LEVELS: { id: PlanLevel; label: string }[] = [
  { id: 'zero', label: 'Começando do zero' },
  { id: 'basico', label: 'Já sei um pouco' },
  { id: 'revisao', label: 'Revisão para prova' },
];
const EXEMPLOS = ['Funções do 2º grau para o ENEM', 'Redação nota 900', 'Inglês para entrevista de emprego', 'Cálculo I: limites e derivadas'];

async function openLink(url: string) {
  try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); } catch (_e) { window.open(url, '_blank'); }
}

export default function PlanoPage() {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [plans, setPlans] = useState<StudyPlan[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [preset, setPreset] = useState<{ goal: string; deadline: string } | null>(null);

  useEffect(() => {
    const read = () => setId(new URLSearchParams(window.location.search).get('id'));
    read();
    // Veio do card da prova (ENEM/ETEC): abre o "criar plano" já preenchido até o dia da prova.
    const q = new URLSearchParams(window.location.search);
    const goal = q.get('objetivo'), prova = q.get('prova');
    if (goal) { setPreset({ goal: goal.slice(0, 200), deadline: prova && /^\d{4}-\d{2}-\d{2}$/.test(prova) ? prova : '' }); setCreating(true); }
    window.addEventListener('popstate', read);
    noricaApi.studyPlanList().then((r) => setPlans(Array.isArray(r?.plans) ? r.plans : [])).catch(() => setPlans([]));
    return () => window.removeEventListener('popstate', read);
  }, []);
  useEffect(() => { if (plans) rememberPlans(plans); }, [plans]);

  const open = (pid: string | null) => { setId(pid); router.replace(pid ? `/caderno/plano/?id=${pid}` : '/caderno/plano/'); };
  const current = plans?.find((p) => p.id === id) ?? null;

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="plano">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => (id ? open(null) : creating ? setCreating(false) : router.replace('/caderno/'))} className="p-3 bg-white/5 border border-white/10 rounded-full text-sky-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-sky-300/80 uppercase tracking-[0.25em]"><MapIcon size={12} /> Plano de estudos</span>
        </div>

        {id && current ? (
          <PlanView key={current.id} plan={current} onChange={(p) => setPlans((l) => (l ?? []).map((x) => (x.id === p.id ? p : x)))} onDeleted={() => { setPlans((l) => (l ?? []).filter((x) => x.id !== current.id)); open(null); }} />
        ) : id && plans === null ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-sky-300" /></div>
        ) : creating || (plans !== null && plans.length === 0) ? (
          <CreatePlan preset={preset} onCreated={(p) => { setPlans((l) => [p, ...(l ?? [])]); setCreating(false); open(p.id); }} />
        ) : (
          <section className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tighter leading-none">Seus <span className="text-sky-300 italic">planos.</span></h1>
              <p className="text-sm text-white/55 font-semibold leading-relaxed">Um pouco por dia, no seu ritmo. A Nórica mostra o que estudar hoje.</p>
            </div>
            {plans === null ? (
              <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-28 rounded-[2rem] bg-white/[0.04] animate-pulse" />)}</div>
            ) : (
              <ul className="space-y-2" data-testid="planos-lista">
                {plans.map((p) => {
                  const nx = planNext(p); const pct = Math.round((p.doneDays.length / p.totalDays) * 100);
                  return (
                    <li key={p.id}>
                      <button onClick={() => open(p.id)} className="w-full p-5 rounded-[2rem] bg-white/5 border border-white/10 text-left space-y-3" data-testid="plano-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[16px] font-black leading-snug">{p.titulo}</p>
                            <p className="text-[11px] text-white/50 font-bold">{p.materia ? `${p.materia} · ` : ''}{p.totalDays} dias · {p.minutes} min/dia</p>
                          </div>
                          <span className="text-2xl font-black text-sky-300 shrink-0">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-sky-300" style={{ width: `${pct}%` }} /></div>
                        <p className="text-[12px] text-white/65 font-semibold">{nx ? `Próximo: Dia ${nx.dia} — ${nx.titulo}` : 'Plano concluído! 🎉'}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button onClick={() => setCreating(true)} className="w-full py-4 rounded-2xl bg-sky-300 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2" data-testid="novo-plano"><Plus size={14} /> Novo plano</button>
          </section>
        )}
      </div>
    </main>
  );
}

function CreatePlan({ onCreated, preset }: { onCreated: (p: StudyPlan) => void; preset?: { goal: string; deadline: string } | null }) {
  const [goal, setGoal] = useState(preset?.goal ?? '');
  const [mode, setMode] = useState<'dias' | 'data'>(preset?.deadline ? 'data' : 'dias');
  const [days, setDays] = useState(14);
  const [deadline, setDeadline] = useState(preset?.deadline ?? '');
  const [minutes, setMinutes] = useState(30);
  const [level, setLevel] = useState<PlanLevel>('basico');
  const [courseId, setCourseId] = useState<string>('');
  const [markExam, setMarkExam] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const courses = useMemo(() => (cachedFaculdade()?.courses ?? []).filter((c) => !c.archived), []);
  const minDate = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');

  const create = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await noricaApi.studyPlanCreate({ goal: goal.trim(), minutes, level, ...(mode === 'data' && deadline ? { deadline } : { days }) });
      if (r.crisis || !r.plan) { setHelp(true); setErr('Parece que algo está pesado agora. Antes de estudar, cuide de você: a ajuda está a um toque. 💙'); return; }
      if (courseId && mode === 'data' && deadline && markExam) {
        await saveEvent({ kind: 'prova', title: goal.trim().slice(0, 60), course_id: courseId, day: deadline }).catch(() => {});
      }
      onCreated(r.plan);
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível montar o plano agora.');
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => `px-3 py-2.5 rounded-2xl border text-[12px] font-black ${on ? 'bg-sky-400/15 border-sky-300/40 text-sky-100' : 'bg-white/[0.04] border-white/10 text-white/55'}`;
  return (
    <section className="space-y-5" data-testid="criar-plano">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tighter leading-none">O que você precisa <span className="text-sky-300 italic">aprender?</span></h1>
        <p className="text-sm text-white/55 font-semibold leading-relaxed">A Nórica monta um plano por dias, com passos, exercícios e videoaulas.</p>
      </div>
      <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} maxLength={600} placeholder="Ex.: Funções do 2º grau para o ENEM" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-sky-300/40 placeholder:text-white/25 resize-none" data-testid="plano-objetivo" />
      {!goal && <div className="flex flex-wrap gap-1.5">{EXEMPLOS.map((e) => <button key={e} onClick={() => setGoal(e)} className="px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-bold text-white/55">{e}</button>)}</div>}

      <div className="space-y-2">
        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Prazo</p>
        <div className="flex gap-1.5">
          <button onClick={() => setMode('dias')} className={chip(mode === 'dias')}>Quantos dias</button>
          <button onClick={() => setMode('data')} className={chip(mode === 'data')} data-testid="modo-data">Até uma data</button>
        </div>
        {mode === 'dias' ? (
          <div className="grid grid-cols-4 gap-1.5">{[7, 14, 21, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={chip(days === d)}>{d} dias</button>)}</div>
        ) : (
          <input type="date" min={minDate} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm [color-scheme:dark]" aria-label="Data da prova" data-testid="plano-data" />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Tempo por dia</p>
        <div className="grid grid-cols-4 gap-1.5">{[15, 30, 45, 60].map((m) => <button key={m} onClick={() => setMinutes(m)} className={chip(minutes === m)}>{m} min</button>)}</div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Como você está nesse assunto</p>
        <div className="flex flex-wrap gap-1.5">{LEVELS.map((l) => <button key={l.id} onClick={() => setLevel(l.id)} className={chip(level === l.id)}>{l.label}</button>)}</div>
      </div>
      {courses.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Matéria da Faculdade (opcional)</p>
          <div className="flex flex-wrap gap-1.5">
            {courses.map((c) => (
              <button key={c.id} onClick={() => setCourseId(courseId === c.id ? '' : c.id)} className="px-3 py-2 rounded-xl border text-[12px] font-bold"
                style={courseId === c.id ? { background: COLORS[c.color].soft, borderColor: COLORS[c.color].hex, color: COLORS[c.color].text } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>{c.name}</button>
            ))}
          </div>
          {courseId && mode === 'data' && (
            <label className="flex items-center gap-2 text-[12px] font-semibold text-white/70"><input type="checkbox" checked={markExam} onChange={(e) => setMarkExam(e.target.checked)} /> Marcar a prova no calendário da Faculdade</label>
          )}
        </div>
      )}
      {err && <p className="text-[12px] font-bold text-rose-300" data-testid="plano-erro">{err}</p>}
      <button onClick={create} disabled={!goal.trim() || busy || (mode === 'data' && !deadline)} className="w-full py-4 rounded-2xl bg-sky-300 text-slate-950 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2" data-testid="criar-plano-btn">
        {busy ? <><Loader2 size={14} className="animate-spin" /> Montando seu plano… (até 30 s)</> : <><Sparkles size={14} /> Montar meu plano</>}
      </button>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </section>
  );
}

function PlanView({ plan, onChange, onDeleted }: { plan: StudyPlan; onChange: (p: StudyPlan) => void; onDeleted: () => void }) {
  const today = planToday(plan);
  const nx = planNext(plan);
  const [open, setOpen] = useState<number | null>(nx?.dia ?? null);
  const [videos, setVideos] = useState<Record<number, { list: PlanVideo[]; searchUrl: string } | 'loading'>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);
  const pct = Math.round((plan.doneDays.length / plan.totalDays) * 100);

  useEffect(() => { setReminder(getPlanReminder().planId === plan.id); }, [plan.id]);

  const loadVideos = async (dia: number) => {
    if (videos[dia]) return;
    setVideos((v) => ({ ...v, [dia]: 'loading' }));
    try {
      const r = await noricaApi.studyPlanVideos(plan.id, dia);
      setVideos((v) => ({ ...v, [dia]: { list: r.videos ?? [], searchUrl: r.searchUrl } }));
    } catch (_e) {
      const d = plan.dias.find((x) => x.dia === dia);
      setVideos((v) => ({ ...v, [dia]: { list: [], searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(d?.busca_video || d?.titulo || '')}` } }));
    }
  };
  const toggleDay = async (dia: number) => {
    const done = !plan.doneDays.includes(dia);
    const optimistic = { ...plan, doneDays: done ? [...plan.doneDays, dia].sort((a, b) => a - b) : plan.doneDays.filter((d) => d !== dia) };
    onChange(optimistic);
    try {
      const r = await noricaApi.studyPlanDay(plan.id, dia, done);
      onChange({ ...optimistic, doneDays: r.doneDays });
      if (done) {
        try { confetti({ particleCount: 60, spread: 60, origin: { y: 0.75 }, colors: ['#7dd3fc', '#34d399', '#fbbf24'] }); } catch (_e) {}
        setToast(r.cardsCreated ? `Dia ${dia} feito! ${r.cardsCreated} ${r.cardsCreated === 1 ? 'cartão foi' : 'cartões foram'} para o Caderno para você relembrar. 📒` : `Dia ${dia} feito! 🎉`);
        setTimeout(() => setToast(null), 4500);
        refreshStudy();
        const next = optimistic.dias.find((d) => !r.doneDays.includes(d.dia));
        if (next) setOpen(next.dia);
      }
    } catch (_e) { onChange(plan); }
  };
  const toggleReminder = async () => {
    const on = !reminder; setReminder(on);
    await setPlanReminder(on ? plan : null);
  };
  const remove = async () => {
    if (!window.confirm('Apagar este plano? As anotações e cartões que já foram para o Caderno continuam lá.')) return;
    await noricaApi.studyPlanDelete(plan.id).catch(() => {});
    if (getPlanReminder().planId === plan.id) setPlanReminder(null);
    onDeleted();
  };

  return (
    <section className="space-y-5" data-testid="plano-ver">
      <div className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter leading-tight">{plan.titulo}</h1>
        <p className="text-[12px] text-white/50 font-bold">{plan.materia ? `${plan.materia} · ` : ''}{plan.totalDays} dias · {plan.minutes} min/dia{plan.deadline ? ` · prova em ${new Date(`${plan.deadline}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-sky-300 transition-all" style={{ width: `${pct}%` }} /></div>
          <span className="text-sm font-black text-sky-300" data-testid="plano-progresso">{plan.doneDays.length}/{plan.totalDays}</span>
        </div>
        {nx && nx.dia < today && <p className="text-[12px] text-amber-200/80 font-semibold">Tudo bem se atrasou. Continue de onde parou — o plano se ajusta a você. 💙</p>}
      </div>

      {toast && <p className="p-3 rounded-2xl bg-emerald-400/10 border border-emerald-300/25 text-[12px] font-bold text-emerald-100 card-in" data-testid="plano-toast">{toast}</p>}

      <ul className="space-y-2">
        {plan.dias.map((d) => {
          const done = plan.doneDays.includes(d.dia); const isOpen = open === d.dia; const isNext = nx?.dia === d.dia;
          const v = videos[d.dia];
          return (
            <li key={d.dia} className={`rounded-[1.75rem] border overflow-hidden ${isNext ? 'bg-sky-400/[0.07] border-sky-300/30' : 'bg-white/5 border-white/10'}`} data-testid="plano-dia">
              <button onClick={() => setOpen(isOpen ? null : d.dia)} className="w-full p-4 flex items-center gap-3 text-left">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black shrink-0 ${done ? 'bg-emerald-400 text-slate-950' : isNext ? 'bg-sky-300 text-slate-950' : 'bg-white/10 text-white/60'}`}>{done ? <Check size={16} /> : d.dia}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[14px] font-black leading-snug ${done ? 'text-white/50' : ''}`}>{d.titulo}</span>
                  {isNext && <span className="block text-[10px] font-black uppercase tracking-widest text-sky-300">{d.dia === today ? 'Hoje' : 'Próximo'}</span>}
                </span>
                <ChevronDown size={16} className={`text-white/30 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 card-in">
                  {d.objetivo && <p className="text-[13px] text-white/80 font-semibold leading-relaxed">🎯 {d.objetivo}</p>}
                  <ol className="space-y-1.5">{d.passos.map((p, i) => <li key={i} className="flex gap-2 text-[13px] text-white/75 leading-snug"><span className="text-sky-300 font-black shrink-0">{i + 1}.</span>{p}</li>)}</ol>
                  {d.exercicio && <p className="p-3 rounded-xl bg-black/25 text-[12px] text-white/70 leading-snug"><b className="text-white/90">Exercício:</b> {d.exercicio}</p>}

                  <div className="space-y-2">
                    {!v ? (
                      <button onClick={() => loadVideos(d.dia)} className="w-full py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-100 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2" data-testid="ver-videos"><PlayCircle size={15} /> Ver videoaulas</button>
                    ) : v === 'loading' ? (
                      <p className="text-[12px] text-white/45 font-semibold flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Procurando videoaulas…</p>
                    ) : (
                      <>
                        {v.list.map((vid) => (
                          <button key={vid.id} onClick={() => openLink(vid.url)} className="w-full flex gap-3 items-center text-left p-2 rounded-xl bg-black/25 border border-white/5" data-testid="video">
                            {vid.thumb ? <img src={vid.thumb} alt="" className="w-24 h-14 rounded-lg object-cover shrink-0" /> : <PlayCircle size={28} className="text-rose-300 shrink-0" />}
                            <span className="min-w-0">
                              <span className="block text-[12px] font-bold leading-snug line-clamp-2">{vid.title}</span>
                              <span className="block text-[10px] text-white/45 font-bold mt-0.5">{vid.channel}</span>
                            </span>
                          </button>
                        ))}
                        <button onClick={() => openLink(v.searchUrl)} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5" data-testid="buscar-youtube"><ExternalLink size={12} /> {v.list.length ? 'Mais vídeos no YouTube' : 'Buscar videoaulas no YouTube'}</button>
                      </>
                    )}
                  </div>

                  <button onClick={() => toggleDay(d.dia)} className={`w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${done ? 'bg-white/5 border border-white/10 text-white/60' : 'bg-emerald-400 text-slate-950'}`} data-testid="concluir-dia">
                    <Check size={14} /> {done ? 'Desmarcar' : 'Concluí este dia'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {plan.dicas.length > 0 && (
        <div className="p-5 rounded-[2rem] bg-white/[0.04] border border-white/10 space-y-2">
          <p className="text-[10px] font-black text-sky-300 uppercase tracking-widest">Dicas para este plano</p>
          {plan.dicas.map((t) => <p key={t} className="text-[13px] text-white/70 font-semibold leading-snug">• {t}</p>)}
        </div>
      )}

      <button onClick={toggleReminder} className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-left" data-testid="plano-lembrete">
        <span className="flex items-center gap-3"><Bell size={16} className="text-sky-300 shrink-0" /><span><span className="block text-[12px] font-black">Lembrete diário às 18h</span><span className="block text-[11px] text-white/45 font-semibold">Com o tema do dia</span></span></span>
        <span role="switch" aria-checked={reminder} className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${reminder ? 'bg-sky-300' : 'bg-white/10'}`}><span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white transition-transform ${reminder ? 'translate-x-5' : 'translate-x-1'}`} /></span>
      </button>
      <button onClick={remove} className="w-full py-3 rounded-2xl bg-rose-500/10 border border-rose-400/20 text-rose-200 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Trash2 size={13} /> Apagar plano</button>
      <p className="text-[10px] text-white/30 font-semibold text-center">A IA pode errar. Na dúvida, confira no material da aula.</p>
    </section>
  );
}
