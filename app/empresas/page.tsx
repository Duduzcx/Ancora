"use client";

// Página de vendas "Nórica para escolas e empresas" (pública, abre no navegador e no app).
// Mostra como funciona, um painel de demonstração e um formulário para agendar conversa.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Anchor, ArrowLeft, ShieldCheck, GraduationCap, Briefcase, LineChart, Megaphone, FileText, HeartHandshake,
  MessageCircle, Moon, Flame, Check, Loader2, Lock, Users, AlertTriangle, Lightbulb, CalendarDays,
} from 'lucide-react';
import { noricaApi, type OrgKind } from '@/lib/norica-api';
import { STORE_URL } from '@/lib/share-text';

const DEMO_MOOD = [
  { k: 'Calmo', v: 38, c: '#34d399' },
  { k: 'Ansioso', v: 36, c: '#fbbf24' },
  { k: 'Agitado', v: 19, c: '#fb7185' },
  { k: 'S.O.S', v: 7, c: '#60a5fa' },
];
const DEMO_WEEKS = [{ l: '3 sem.', v: 41 }, { l: '2 sem.', v: 45 }, { l: '1 sem.', v: 51 }, { l: 'Agora', v: 58 }];
const DEMO_SECTORS = [
  { n: '1º ano', a: 34, h: 47, d: '+2' },
  { n: '2º ano', a: 29, h: 52, d: '+6' },
  { n: '3º ano', a: 41, h: 71, d: '+15' },
  { n: 'Cursinho', a: 22, h: 55, d: '−3' },
];
const SIZES = ['até 50', '51 a 200', '201 a 1.000', 'mais de 1.000'];

export default function EmpresasPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', orgName: '', kind: 'escola' as OrgKind, size: SIZES[1], phone: '', email: '', message: '', site: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await noricaApi.leadCreate(form); setSent(true); }
    catch (er: any) { setErr(er?.message || 'Não foi possível enviar agora. Tente de novo.'); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-[100dvh] bg-[#021013] text-white overflow-x-hidden" data-testid="empresas">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.14)_0%,transparent_55%)]" />

      <header className="relative z-10 max-w-5xl mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] flex items-center justify-between">
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))} className="flex items-center gap-2 text-emerald-300" aria-label="Voltar">
          <ArrowLeft size={18} /><Anchor size={20} /><span className="font-black tracking-tight">Nórica</span>
        </button>
        <button onClick={() => go('contato')} className="px-4 py-2 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-widest">Agendar conversa</button>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-14 pb-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300/80">Para escolas, cursinhos e empresas</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.95]">Saiba como o seu grupo está <span className="text-emerald-300 italic">— sem expor ninguém.</span></h1>
          <p className="text-[15px] text-white/65 font-semibold leading-relaxed">A Nórica é um app de apoio emocional com IA. Cada pessoa cuida de si em privado; a instituição vê apenas números somados e anônimos, com alertas e ações sugeridas para agir antes que o cansaço vire crise.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => go('contato')} className="px-6 py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest">Agendar uma conversa</button>
            <button onClick={() => go('demo')} className="px-6 py-4 rounded-2xl bg-white/5 border border-white/15 text-[11px] font-black uppercase tracking-widest">Ver o painel</button>
          </div>
          <p className="text-[12px] text-white/45 font-semibold">30 dias de teste grátis · sem cartão · funciona em qualquer Android</p>
        </div>
        <DemoMini />
      </section>

      {/* Como funciona */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-14 space-y-8">
        <h2 className="text-3xl font-black tracking-tighter">Como funciona</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: '1', t: 'Vocês criam a instituição', d: 'Em 1 minuto, pelo app. Recebem um código para alunos ou funcionários e outro para a equipe.' },
            { n: '2', t: 'Cada pessoa entra com o código', d: 'Baixa a Nórica, digita o código e escolhe a turma ou o setor. O que ela escreve continua só dela.' },
            { n: '3', t: 'A equipe acompanha o grupo', d: 'Painel com humor da semana, temas que pesam, alertas por turma/setor, campanhas e relatório mensal em PDF.' },
          ].map((s) => (
            <div key={s.n} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-2">
              <span className="w-9 h-9 rounded-xl bg-emerald-400/15 text-emerald-300 font-black flex items-center justify-center">{s.n}</span>
              <p className="text-lg font-black tracking-tight">{s.t}</p>
              <p className="text-[13px] text-white/60 font-semibold leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* O que cada pessoa ganha */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-14 space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tighter">O que cada pessoa recebe</h2>
          <p className="text-[14px] text-white/55 font-semibold">Um lugar seguro no bolso, 24 horas, com cuidado de verdade em situações de risco.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { i: MessageCircle, t: 'Conversa com IA acolhedora', d: 'Escuta sem julgar, ajuda a organizar a cabeça e indica o CVV 188 quando precisa.' },
            { i: HeartHandshake, t: 'S.O.S e plano de segurança', d: 'Respiração guiada, caixa de calma e contatos de confiança a um toque.' },
            { i: Moon, t: 'Sono e meditações', d: 'Meditações guiadas com voz natural, sons do mar e modo noite.' },
            { i: Flame, t: 'Cuidar junto', d: 'Foguinho com amigos e com a turma, desafios leves e chat seguro.' },
          ].map((f) => (
            <div key={f.t} className="p-5 rounded-[1.75rem] bg-white/5 border border-white/10 space-y-2">
              <f.i size={20} className="text-emerald-300" />
              <p className="text-sm font-black leading-tight">{f.t}</p>
              <p className="text-[12px] text-white/55 font-semibold leading-snug">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Painel de demonstração */}
      <section id="demo" className="relative z-10 max-w-5xl mx-auto px-6 py-14 space-y-8 scroll-mt-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tighter">O que a instituição vê</h2>
          <p className="text-[14px] text-white/55 font-semibold">Exemplo com números fictícios de uma escola. Grupos com menos de 5 pessoas ativas nunca aparecem.</p>
        </div>
        <DemoFull />
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { i: LineChart, t: 'Tendência semanal', d: 'Quantas pessoas tiveram dias difíceis, comparando com as semanas anteriores.' },
            { i: Megaphone, t: 'Campanhas com um toque', d: 'Janeiro Branco, provas, sono, Setembro Amarelo: a mensagem aparece no app de todos.' },
            { i: FileText, t: 'Relatório mensal em PDF', d: 'Pronto para levar à direção, à coordenação ou ao RH.' },
          ].map((f) => (
            <div key={f.t} className="flex gap-3 p-5 rounded-[1.75rem] bg-white/5 border border-white/10">
              <f.i size={20} className="text-amber-300 shrink-0" />
              <div><p className="text-sm font-black">{f.t}</p><p className="text-[12px] text-white/55 font-semibold leading-snug mt-1">{f.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Privacidade */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-14">
        <div className="p-8 rounded-[2.5rem] bg-emerald-500/[0.06] border border-emerald-400/20 grid md:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="w-14 h-14 rounded-2xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center"><ShieldCheck size={26} /></div>
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tighter">Privacidade de verdade, de acordo com a LGPD</h2>
            <ul className="grid md:grid-cols-2 gap-2">
              {[
                'A instituição nunca vê conversas, diário ou o humor de uma pessoa.',
                'Números só aparecem com 5 ou mais pessoas ativas no grupo.',
                'Temas só contam quando 3 ou mais pessoas falaram deles.',
                'Conversas e diários ficam criptografados (AES-256).',
                'Cada pessoa pode sair da instituição quando quiser.',
                'Não é diagnóstico nem substitui atendimento profissional.',
              ].map((t) => <li key={t} className="flex items-start gap-2 text-[13px] text-white/75 font-semibold"><Lock size={13} className="text-emerald-300 shrink-0 mt-1" /> {t}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="relative z-10 max-w-5xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10 scroll-mt-6">
        <div className="space-y-4">
          <h2 className="text-3xl font-black tracking-tighter">Vamos conversar?</h2>
          <p className="text-[14px] text-white/60 font-semibold leading-relaxed">Conte um pouco sobre a sua instituição. A gente mostra o painel ao vivo, tira dúvidas e monta um plano do tamanho do seu grupo.</p>
          <ul className="space-y-2">
            {['Teste grátis de 30 dias', 'Implantação em 1 dia, sem TI', 'Preço por pessoa, para escolas e empresas', 'Material pronto para divulgar aos alunos ou à equipe'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-[13px] text-white/75 font-semibold"><Check size={15} className="text-emerald-300" /> {t}</li>
            ))}
          </ul>
          <p className="text-[12px] text-white/45 font-semibold">Prefere testar sozinho? Baixe o app e vá em <b className="text-white/70">Perfil → Instituição Parceira → Criar minha instituição</b>. Para ver o painel de exemplo, use o código <b className="text-white/70">DEMOESCOLA</b> ou <b className="text-white/70">DEMOEMPRESA</b>.</p>
          <a href={STORE_URL} className="inline-block text-[11px] font-black uppercase tracking-widest text-emerald-300 underline underline-offset-4">Baixar na Google Play</a>
        </div>

        {sent ? (
          <div className="p-8 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-400/25 space-y-3 self-start" data-testid="contato-enviado">
            <p className="text-3xl">💚</p>
            <p className="text-xl font-black">Recebemos! Logo falamos com você.</p>
            <p className="text-[13px] text-white/60 font-semibold">Enquanto isso, que tal ver o painel de exemplo no app com o código {form.kind === 'escola' ? 'DEMOESCOLA' : 'DEMOEMPRESA'}?</p>
          </div>
        ) : (
          <form onSubmit={send} className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-3" data-testid="form-contato">
            <div className="grid grid-cols-2 gap-2">
              {([['escola', 'Escola / cursinho', GraduationCap], ['empresa', 'Empresa', Briefcase]] as const).map(([k, l, Icon]) => (
                <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, kind: k }))} aria-pressed={form.kind === k} className={`py-3 rounded-2xl border text-[11px] font-black flex items-center justify-center gap-2 ${form.kind === k ? 'bg-emerald-400/15 border-emerald-300/40 text-emerald-100' : 'bg-black/20 border-white/10 text-white/55'}`}><Icon size={14} /> {l}</button>
              ))}
            </div>
            <input value={form.name} onChange={set('name')} required maxLength={80} placeholder="Seu nome" className={field} />
            <input value={form.orgName} onChange={set('orgName')} required maxLength={120} placeholder={form.kind === 'escola' ? 'Nome da escola ou cursinho' : 'Nome da empresa'} className={field} />
            <select value={form.size} onChange={set('size')} className={field} aria-label="Quantas pessoas">
              {SIZES.map((s) => <option key={s} value={s} className="bg-[#0b1a1f]">{s} {form.kind === 'escola' ? 'alunos' : 'pessoas'}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.phone} onChange={set('phone')} maxLength={30} inputMode="tel" placeholder="WhatsApp" className={field} />
              <input value={form.email} onChange={set('email')} maxLength={120} type="email" placeholder="E-mail" className={field} />
            </div>
            <textarea value={form.message} onChange={set('message')} maxLength={600} rows={3} placeholder="Quer contar algo? (opcional)" className={`${field} resize-none`} />
            {/* campo escondido contra robôs */}
            <input value={form.site} onChange={set('site')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {err && <p className="text-xs font-bold text-rose-300">{err}</p>}
            <button type="submit" disabled={busy} className="w-full py-4 rounded-2xl bg-emerald-400 text-slate-950 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} Quero agendar uma conversa
            </button>
            <p className="text-[10px] text-white/35 font-semibold text-center">Usamos seus dados só para falar sobre a Nórica com você.</p>
          </form>
        )}
      </section>

      <footer className="relative z-10 max-w-5xl mx-auto px-6 py-10 border-t border-white/5 text-[11px] text-white/35 font-semibold flex flex-wrap gap-4 justify-between">
        <span>Nórica · apoio emocional com IA · não substitui atendimento profissional. Em crise: CVV 188 (24h) ou SAMU 192.</span>
        <a href="/privacidade/" className="underline underline-offset-4">Privacidade</a>
      </footer>
    </main>
  );
}

const field = 'w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white outline-none focus:border-emerald-300/50 placeholder:text-white/30';

function DemoMini() {
  return (
    <div className="p-6 rounded-[2.5rem] bg-white/[0.04] border border-white/10 space-y-4 shadow-2xl" aria-label="Exemplo do painel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black">Colégio Exemplo</p>
        <span className="px-2.5 py-1 rounded-full bg-sky-400/15 text-sky-200 text-[9px] font-black uppercase tracking-widest">Demonstração</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-black/25"><p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Ativos</p><p className="text-3xl font-black">126</p></div>
        <div className="p-4 rounded-2xl bg-black/25"><p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Dia difícil</p><p className="text-3xl font-black text-amber-300">58%</p></div>
      </div>
      <MoodBar />
      <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-400/10 border border-amber-300/20 text-[12px] font-semibold text-amber-100/90"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> 3º ano: +15 pontos de dias difíceis. Perto das provas?</div>
    </div>
  );
}

function MoodBar() {
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden gap-[2px]">
        {DEMO_MOOD.map((m) => <div key={m.k} style={{ width: `${m.v}%`, background: m.c }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {DEMO_MOOD.map((m) => <span key={m.k} className="flex items-center gap-1 text-[10px] font-bold text-white/60"><i className="w-2 h-2 rounded-sm inline-block" style={{ background: m.c }} />{m.k} {m.v}%</span>)}
      </div>
    </div>
  );
}

function DemoFull() {
  const max = Math.max(...DEMO_WEEKS.map((w) => w.v));
  return (
    <div className="grid md:grid-cols-2 gap-4" data-testid="demo-painel">
      <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
        <p className="flex items-center gap-2 text-sm font-black"><Users size={15} className="text-emerald-300" /> Humor do grupo nesta semana</p>
        <MoodBar />
        <p className="text-[12px] text-white/55 font-semibold">Temas que mais pesam: <b className="text-white/80">provas (39%)</b>, <b className="text-white/80">sono (24%)</b>, <b className="text-white/80">família (16%)</b>.</p>
        <p className="flex items-center gap-2 text-sm font-black pt-2"><CalendarDays size={15} className="text-amber-300" /> Pessoas com algum dia difícil</p>
        <div className="flex items-end gap-3 h-28">
          {DEMO_WEEKS.map((w) => (
            <div key={w.l} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-black text-white/70">{w.v}%</span>
              <div className="w-full rounded-t-lg bg-amber-400/80" style={{ height: `${(w.v / max) * 80}px` }} />
              <span className="text-[9px] font-bold text-white/40">{w.l}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
        <p className="flex items-center gap-2 text-sm font-black"><GraduationCap size={15} className="text-emerald-300" /> Por turma</p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[9px] font-black text-white/40 uppercase tracking-widest"><span>Turma</span><span>Ativos</span><span>Difícil</span><span>Semana</span></div>
          {DEMO_SECTORS.map((s) => (
            <div key={s.n} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[13px] font-bold items-center">
              <span>{s.n}</span><span className="text-white/70 text-right w-10">{s.a}</span><span className="text-amber-300 text-right w-10">{s.h}%</span>
              <span className={`text-right w-12 ${s.d.startsWith('+1') ? 'text-rose-300' : 'text-white/50'}`}>{s.d}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-[12px] font-semibold text-emerald-100/90"><Lightbulb size={14} className="shrink-0 mt-0.5" /> Sugestão: ativar a campanha "Semana de provas" para o 3º ano e reforçar o CVV 188.</div>
      </div>
    </div>
  );
}
