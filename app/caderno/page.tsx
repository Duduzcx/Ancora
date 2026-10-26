"use client";

// Caderno: anotar o que aprendeu, ideias e o que não pode esquecer. A Nórica organiza
// (título, matéria, etiquetas) e cria cartões de revisão para a pessoa não esquecer.

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mic, Square, Loader2, Check, Search, RotateCcw, Sparkles, MessageCircleQuestion, Timer, Pin, PinOff, Trash2, ChevronDown, Plus, X, NotebookPen, Bell } from 'lucide-react';
import { noricaApi, type NoteKind, type StudyNote, type StudySummary } from '@/lib/norica-api';
import { KINDS, kindInfo, cachedStudy, refreshStudy, useVoiceNote, dayLabel, getReviewReminder, setReviewReminder, cachedNotes, rememberNotes } from '@/lib/caderno';
import { HelpSheet } from '@/components/AjudaAgora';

export default function CadernoPage() {
  const router = useRouter();
  const [kind, setKind] = useState<NoteKind>('aprendizado');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ note: StudyNote; cards: number; aiNote: string | null; organizing?: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [notes, setNotes] = useState<StudyNote[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [filter, setFilter] = useState<NoteKind | 'todas'>('todas');
  const [subject, setSubject] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [summary, setSummary] = useState<StudySummary | null>(null);
  const [reminder, setReminder] = useState({ on: false, hour: 19 });
  const [materia, setMateria] = useState<string | null>(null);
  const voice = useVoiceNote((t) => setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t)));

  // A lista aparece na hora a partir do aparelho (só títulos e resumos) e se atualiza quando o servidor responde.
  const load = () => noricaApi.studyNoteList().then((r) => { setNotes(r.notes); setSubjects(r.subjects); rememberNotes(r.notes, r.subjects); }).catch(() => setNotes((n) => n ?? []));
  useEffect(() => {
    const cached = cachedNotes();
    if (cached) { setNotes(cached.notes); setSubjects(cached.subjects); }
    setSummary(cachedStudy());
    const m = new URLSearchParams(window.location.search).get('materia');
    if (m) setMateria(m.slice(0, 40));
    setReminder(getReviewReminder());
    load();
    refreshStudy().then((s) => s && setSummary(s));
  }, []);

  // Mantém a cópia do aparelho em dia (depois de salvar, fixar ou apagar).
  useEffect(() => { if (notes && notes.length) rememberNotes(notes, subjects); }, [notes, subjects]);

  const save = async () => {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true); setErr(null); setSaved(null);
    try {
      const r = await noricaApi.studyNoteSave({ kind, content, ...(materia ? { subject: materia } : {}) });
      setSaved({ note: r.note, cards: r.cardsCreated, aiNote: r.aiNote, organizing: !!r.organizing });
      setText('');
      setNotes((n) => [r.note, ...(n ?? [])]);
      if (r.note.subject) setSubjects((s) => (s.includes(r.note.subject) ? s : [r.note.subject, ...s]));
      if (r.crisis) setHelp(true);
      if (r.organizing) followOrganizing(r.note.id);
      else refreshStudy().then((s) => s && setSummary(s));
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar agora. Seu texto continua aqui.');
    } finally {
      setSaving(false);
    }
  };

  // A IA organiza depois de salvar: busca o resultado a cada 1,5 s (até 25 s) e atualiza a tela.
  const followOrganizing = async (id: string) => {
    for (let i = 0; i < 16; i++) {
      await new Promise((res) => setTimeout(res, i === 0 ? 2000 : 1500));
      try {
        const r = await noricaApi.studyNoteGet(id);
        if (r.note.aiState === 'pendente') continue;
        setNotes((n) => (n ?? []).map((x) => (x.id === id ? r.note : x)));
        setSaved((cur) => (cur && cur.note.id === id ? { note: r.note, cards: r.note.cards, aiNote: r.aiNote, organizing: false } : cur));
        if (r.note.subject) setSubjects((s) => (s.includes(r.note.subject) ? s : [r.note.subject, ...s]));
        refreshStudy().then((s) => s && setSummary(s));
        return;
      } catch (_e) { /* tenta de novo */ }
    }
    setSaved((cur) => (cur && cur.note.id === id ? { ...cur, organizing: false } : cur));
  };

  const shown = useMemo(() => {
    let list = notes ?? [];
    if (filter !== 'todas') list = list.filter((n) => n.kind === filter);
    if (subject) list = list.filter((n) => n.subject === subject);
    const t = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (t) list = list.filter((n) => `${n.title} ${n.content} ${n.subject} ${n.tags.join(' ')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes, filter, subject, q]);

  const remove = async (id: string) => {
    if (!window.confirm('Apagar esta anotação e os cartões de revisão dela?')) return;
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
    await noricaApi.studyNoteDelete(id).catch(() => {});
    refreshStudy().then((s) => s && setSummary(s));
  };
  const pin = async (n: StudyNote) => {
    setNotes((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, pinned: !n.pinned } : x)));
    noricaApi.studyNotePin(n.id, !n.pinned).catch(() => {});
  };
  const toggleReminder = async () => {
    const next = { ...reminder, on: !reminder.on };
    setReminder(next);
    const ok = await setReviewReminder(next);
    if (next.on && !ok) setErr('Para receber o lembrete, ative as notificações em Perfil → Lembretes.');
  };

  const info = kindInfo(kind);
  const due = summary?.due ?? 0;

  return (
    <main className="min-h-[100dvh] relative overflow-x-hidden pb-40 text-white" data-testid="caderno">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.replace('/exercicios/')} className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-300" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300/80 uppercase tracking-[0.25em]"><NotebookPen size={12} /> Caderno</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Seu caderno de <span className="text-emerald-300 italic">estudos e ideias.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Anote do seu jeito, escrevendo ou falando. A Nórica organiza e te ajuda a lembrar depois.</p>
        </div>

        {/* Números */}
        <div className="grid grid-cols-3 gap-2" data-testid="caderno-resumo">
          {[
            { n: due, l: due === 1 ? 'cartão hoje' : 'cartões hoje' },
            { n: summary?.streak ?? 0, l: (summary?.streak ?? 0) === 1 ? 'dia seguido' : 'dias seguidos' },
            { n: summary?.notes ?? notes?.length ?? 0, l: 'anotações' },
          ].map((s) => (
            <div key={s.l} className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
              <p className="text-2xl font-black tracking-tighter">{s.n}</p>
              <p className="text-[9px] font-black text-white/45 uppercase tracking-widest leading-tight">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Anotar */}
        <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3" data-testid="anotar">
          {materia && (
            <p className="flex items-center justify-between text-[11px] font-black text-emerald-200" data-testid="anotar-materia-chip">
              <span>📚 Anotando em: {materia}</span>
              <button onClick={() => setMateria(null)} className="text-white/40" aria-label="Tirar matéria"><X size={13} /></button>
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black ${kind === k.id ? k.cls : 'bg-white/[0.03] border-white/10 text-white/55'}`}>
                <k.icon size={13} /> {k.label}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={6000} placeholder={info.hint}
            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-300/40 placeholder:text-white/25 resize-none leading-relaxed" data-testid="nota-texto" />
          {voice.state === 'recording' && (
            <p className="text-[11px] font-black text-rose-300 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> Gravando… {voice.seconds}s (toque no quadrado para parar)</p>
          )}
          {(voice.error || err) && <p className="text-[11px] font-bold text-rose-300">{voice.error || err}</p>}
          <div className="flex gap-2">
            <button onClick={voice.state === 'recording' ? voice.stop : voice.start} disabled={voice.state === 'processing' || saving}
              className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border ${voice.state === 'recording' ? 'bg-rose-500 border-rose-400 text-white' : 'bg-white/5 border-white/10 text-emerald-300'}`}
              aria-label={voice.state === 'recording' ? 'Parar gravação' : 'Falar em vez de escrever'}>
              {voice.state === 'processing' ? <Loader2 size={18} className="animate-spin" /> : voice.state === 'recording' ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
            </button>
            <button onClick={save} disabled={!text.trim() || saving || voice.state !== 'idle'}
              className="flex-1 h-12 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2" data-testid="nota-salvar">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><Sparkles size={14} /> Guardar no Caderno</>}
            </button>
          </div>
          {saved && (
            <div className="p-4 rounded-2xl bg-emerald-400/10 border border-emerald-300/25 space-y-1.5 card-in" data-testid="nota-salva">
              <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5"><Check size={12} /> Guardado na hora</p>
              <p className="text-sm font-black">{saved.note.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {saved.note.subject && <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold">{saved.note.subject}</span>}
                {saved.note.tags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/60">#{t}</span>)}
              </div>
              {saved.organizing && <p className="text-[12px] text-white/60 font-semibold flex items-center gap-2" data-testid="organizando"><Loader2 size={13} className="animate-spin" /> A Nórica está organizando e criando seus cartões…</p>}
              {saved.cards > 0 && <p className="text-[12px] text-white/70 font-semibold">📒 {saved.cards} {saved.cards === 1 ? 'cartão de revisão criado' : 'cartões de revisão criados'} — eles aparecem para você relembrar nos próximos dias.</p>}
              {saved.aiNote && <p className="text-[11px] text-amber-200/80 font-semibold">{saved.aiNote}</p>}
            </div>
          )}
        </section>

        {/* Ferramentas */}
        <section className="grid grid-cols-2 gap-2">
          {[
            { href: '/caderno/revisar/', icon: RotateCcw, t: 'Relembrar', d: due ? `${due} para hoje` : 'tudo em dia ✓', c: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/20', badge: due, id: 'revisar' },
            { href: '/caderno/estudar/', icon: Sparkles, t: 'Estudar com a IA', d: 'explica, resume e faz quiz', c: 'text-violet-300 bg-violet-400/10 border-violet-300/20', id: 'estudar' },
            { href: '/caderno/perguntar/', icon: MessageCircleQuestion, t: 'O que eu anotei?', d: 'pergunte ao Caderno', c: 'text-sky-300 bg-sky-400/10 border-sky-300/20', id: 'perguntar' },
            { href: '/caderno/foco/', icon: Timer, t: 'Foco', d: summary?.weekMinutes ? `${summary.weekMinutes} min na semana` : '25 min com som do mar', c: 'text-amber-300 bg-amber-400/10 border-amber-300/20', id: 'foco' },
          ].map((x) => (
            <button key={x.href} onClick={() => router.push(x.href)} className="relative p-4 rounded-[1.75rem] bg-white/5 border border-white/10 text-left active:scale-[0.97] transition-transform" data-testid={`ferramenta-${x.id}`}>
              <span className={`w-11 h-11 rounded-2xl border flex items-center justify-center mb-3 ${x.c}`}><x.icon size={20} /></span>
              <span className="block text-[13px] font-black tracking-tight leading-tight">{x.t}</span>
              <span className="block text-[11px] text-white/50 font-semibold mt-0.5">{x.d}</span>
              {!!x.badge && <span className="absolute top-3 right-3 min-w-6 h-6 px-1.5 rounded-full bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center justify-center">{x.badge}</span>}
            </button>
          ))}
        </section>

        {/* Anotações */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-2xl px-4">
            <Search size={15} className="text-white/40 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar nas anotações" className="flex-1 min-w-0 bg-transparent py-3 text-sm outline-none placeholder:text-white/30" data-testid="busca" />
            {q && <button onClick={() => setQ('')} aria-label="Limpar"><X size={14} className="text-white/40" /></button>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-6 px-6 pb-1">
            {(['todas', ...KINDS.map((k) => k.id)] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border ${filter === k ? 'bg-white/15 border-white/30' : 'border-white/10 text-white/50'}`}>
                {k === 'todas' ? 'Todas' : kindInfo(k).short}
              </button>
            ))}
            {subjects.map((s) => (
              <button key={s} onClick={() => setSubject(subject === s ? null : s)} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border ${subject === s ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-100' : 'border-white/10 text-white/50'}`}>{s}</button>
            ))}
          </div>

          {notes === null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-[1.75rem] bg-white/[0.04] border border-white/5 animate-pulse" />)}</div>
          ) : shown.length === 0 ? (
            <div className="p-6 rounded-[2rem] border border-dashed border-white/15 text-center space-y-2" data-testid="caderno-vazio">
              <p className="text-3xl">📒</p>
              <p className="text-sm font-black">{notes.length ? 'Nada encontrado com esse filtro.' : 'Seu caderno está esperando a primeira anotação.'}</p>
              {!notes.length && <p className="text-[12px] text-white/50 font-semibold leading-relaxed">Algo que você aprendeu na aula, uma ideia que não quer perder ou uma coisa que não pode esquecer. Pode ser curtinho.</p>}
            </div>
          ) : (
            <ul className="space-y-2" data-testid="notas">
              {shown.map((n) => <NoteItem key={n.id} n={n} open={open === n.id} onToggle={() => setOpen(open === n.id ? null : n.id)} onPin={() => pin(n)} onDelete={() => remove(n.id)} onChanged={() => refreshStudy().then((s) => s && setSummary(s))} />)}
            </ul>
          )}
        </section>

        <button onClick={toggleReminder} className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-left" data-testid="lembrete-revisao">
          <span className="flex items-center gap-3">
            <Bell size={16} className="text-emerald-300 shrink-0" />
            <span>
              <span className="block text-[12px] font-black">Lembrete diário para relembrar</span>
              <span className="block text-[11px] text-white/45 font-semibold">Todo dia às {reminder.hour}h, com os cartões do dia</span>
            </span>
          </span>
          <span role="switch" aria-checked={reminder.on} className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${reminder.on ? 'bg-emerald-400' : 'bg-white/10'}`}>
            <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white transition-transform ${reminder.on ? 'translate-x-5' : 'translate-x-1'}`} />
          </span>
        </button>
      </div>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </main>
  );
}

function NoteItem({ n, open, onToggle, onPin, onDelete, onChanged }: { n: StudyNote; open: boolean; onToggle: () => void; onPin: () => void; onDelete: () => void; onChanged: () => void }) {
  const k = kindInfo(n.kind);
  const [cards, setCards] = useState<{ id: string; front: string; back: string }[] | null>(n.cardList ?? null);
  const [adding, setAdding] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && cards === null) noricaApi.studyNoteCards(n.id).then((r) => setCards(Array.isArray(r?.cards) ? r.cards : [])).catch(() => setCards([]));
  }, [open]);
  useEffect(() => { if (n.cardList) setCards(n.cardList); }, [n.cardList]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCard = async () => {
    if (!front.trim() || !back.trim()) return;
    setBusy(true);
    try {
      await noricaApi.studyCardSave(front.trim(), back.trim(), n.id);
      setCards((c) => [...(c ?? []), { id: `novo-${Date.now()}`, front: front.trim(), back: back.trim() }]);
      setFront(''); setBack(''); setAdding(false); onChanged();
    } catch (_e) {} finally { setBusy(false); }
  };
  const delCard = async (id: string) => {
    setCards((c) => (c ?? []).filter((x) => x.id !== id));
    if (!id.startsWith('novo-')) await noricaApi.studyCardDelete(id).catch(() => {});
    onChanged();
  };

  return (
    <li className="rounded-[1.75rem] bg-white/5 border border-white/10 overflow-hidden" data-testid="nota">
      <button onClick={onToggle} className="w-full p-4 text-left flex gap-3 items-start">
        <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: k.dot }} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            {n.pinned && <Pin size={11} className="text-amber-300 shrink-0" />}
            <span className="text-[14px] font-black tracking-tight leading-snug truncate">{n.title}</span>
          </span>
          <span className={`block text-[12px] text-white/55 font-semibold leading-snug mt-0.5 ${open ? '' : 'line-clamp-2'}`}>{n.summary || n.content}</span>
          <span className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[9px] font-black text-white/35 uppercase tracking-widest">{dayLabel(n.created_at)}</span>
            {n.subject && <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold">{n.subject}</span>}
            {n.cards > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-200 text-[10px] font-bold">📒 {n.cards}</span>}
          </span>
        </span>
        <ChevronDown size={16} className={`text-white/30 shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 card-in">
          {n.summary && <p className="text-[13px] text-white/80 font-medium leading-relaxed whitespace-pre-wrap border-l-2 border-white/10 pl-3">{n.content}</p>}
          {n.tags.length > 0 && <p className="text-[11px] text-white/45 font-bold">{n.tags.map((t) => `#${t}`).join('  ')}</p>}
          <div className="space-y-1.5">
            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Cartões de revisão</p>
            {cards === null ? <Loader2 size={14} className="animate-spin text-white/40" /> : cards.length === 0 && !adding ? (
              <p className="text-[11px] text-white/40 font-semibold">Nenhum cartão ainda.</p>
            ) : cards.map((c) => (
              <div key={c.id} className="flex gap-2 items-start p-3 rounded-xl bg-black/25 border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black leading-snug">{c.front}</p>
                  <p className="text-[12px] text-white/55 font-semibold leading-snug mt-0.5">{c.back}</p>
                </div>
                <button onClick={() => delCard(c.id)} aria-label="Apagar cartão" className="p-1 text-white/30"><X size={13} /></button>
              </div>
            ))}
            {adding ? (
              <div className="space-y-2 p-3 rounded-xl bg-black/25 border border-white/10">
                <input value={front} onChange={(e) => setFront(e.target.value)} maxLength={200} placeholder="Pergunta (ex.: O que a planta produz?)" className="w-full bg-transparent text-[12px] font-bold outline-none placeholder:text-white/30" />
                <input value={back} onChange={(e) => setBack(e.target.value)} maxLength={300} placeholder="Resposta" className="w-full bg-transparent text-[12px] outline-none placeholder:text-white/30" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAdding(false)} className="text-[10px] font-black uppercase tracking-widest text-white/40">Cancelar</button>
                  <button onClick={addCard} disabled={busy || !front.trim() || !back.trim()} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 disabled:opacity-40">Salvar cartão</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1"><Plus size={12} /> Criar cartão</button>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onPin} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
              {n.pinned ? <><PinOff size={12} /> Desafixar</> : <><Pin size={12} /> Fixar no topo</>}
            </button>
            <button onClick={onDelete} className="py-2.5 px-4 rounded-xl bg-rose-500/10 border border-rose-400/20 text-rose-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Trash2 size={12} /> Apagar</button>
          </div>
        </div>
      )}
    </li>
  );
}
