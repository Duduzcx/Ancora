"use client";

// Relatório mensal (Pro): os últimos 30 dias em um PDF para levar ao psicólogo.
// O PDF é montado no próprio celular (nada sai do aparelho além do pedido à Nórica)
// e aberto no menu de compartilhar do Android (WhatsApp, e-mail, Drive…).

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Lock, Download } from 'lucide-react';
import { shareFile } from '@/lib/share-file';
import { noricaApi, type MonthlyReport } from '@/lib/norica-api';
import { MOOD_LABEL, MOOD_COLOR, TASK_LABELS } from '@/lib/farol';
import { reportError } from '@/lib/error-report';

const plain = (s: string) => s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\*\*/g, '').trim();
const br = (iso: string) => iso.split('-').reverse().join('/');
const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as any;

export async function buildReportPdf(r: MonthlyReport): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = 0;

  // Cabeçalho
  doc.setFillColor(2, 16, 19);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(52, 211, 153);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('NÓRICA  ·  RELATÓRIO MENSAL', M, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(r.name ? `O mar de ${r.name}` : 'O seu mar', M, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 200);
  doc.text(`${br(r.start)} a ${br(r.end)}  ·  gerado em ${new Date().toLocaleDateString('pt-BR')}`, M, 29);
  y = 44;

  const section = (title: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setTextColor(16, 120, 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), M, y);
    y += 6;
    doc.setTextColor(40, 50, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };
  const para = (text: string, size = 10, lh = 5) => {
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, W - 2 * M)) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, M, y);
      y += lh;
    }
  };

  // Faixa de 30 dias de humor
  section('Humor dia a dia');
  const cell = (W - 2 * M) / 30;
  r.series.forEach((p, i) => {
    const x = M + i * cell;
    if (p.mood && MOOD_COLOR[p.mood as keyof typeof MOOD_COLOR]) doc.setFillColor(...hex(MOOD_COLOR[p.mood as keyof typeof MOOD_COLOR]));
    else doc.setFillColor(225, 230, 232);
    doc.roundedRect(x + 0.4, y, cell - 0.8, 9, 1, 1, 'F');
    if (i % 5 === 0) {
      doc.setFontSize(6);
      doc.setTextColor(120, 130, 135);
      doc.text(p.day.slice(8, 10) + '/' + p.day.slice(5, 7), x + 0.4, y + 13);
    }
  });
  y += 19;
  let lx = M;
  doc.setFontSize(8);
  for (const k of Object.keys(MOOD_LABEL) as (keyof typeof MOOD_LABEL)[]) {
    doc.setFillColor(...hex(MOOD_COLOR[k]));
    doc.rect(lx, y - 2.6, 3, 3, 'F');
    doc.setTextColor(60, 70, 75);
    const t = `${MOOD_LABEL[k]}: ${r.moodCount[k] ?? 0} dia(s)`;
    doc.text(t, lx + 4.5, y);
    lx += doc.getTextWidth(t) + 11;
  }
  const empty = r.series.filter((p) => !p.mood).length;
  doc.setFillColor(225, 230, 232);
  doc.rect(lx, y - 2.6, 3, 3, 'F');
  doc.text(`Sem registro: ${empty}`, lx + 4.5, y);
  y += 11;

  if (r.prevMoodCount && Object.values(r.prevMoodCount).some((n) => n)) {
    section('Comparado com os 30 dias anteriores');
    const pm = r.prevMoodCount;
    const rows = (Object.keys(MOOD_LABEL) as (keyof typeof MOOD_LABEL)[]).map((k) => {
      const now = r.moodCount[k] ?? 0, before = pm[k] ?? 0, d = now - before;
      return `${MOOD_LABEL[k]}: ${before} → ${now} dia(s)${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}`;
    });
    para(rows.join('   ·   '));
    const heavy = (m: Record<string, number>) => (m.ansioso ?? 0) + (m.agitado ?? 0) + (m.sos ?? 0);
    const dh = heavy(r.moodCount) - heavy(pm);
    para(dh < 0 ? `Menos dias pesados que no período anterior (${-dh} a menos).` : dh > 0 ? `Mais dias pesados que no período anterior (${dh} a mais) — vale conversar sobre o que mudou.` : 'Dias pesados na mesma quantidade do período anterior.');
    y += 3;
  }

  section('Cuidados do dia a dia (Logs)');
  para(`Dias com pelo menos um hábito marcado: ${r.habitDays} de 30.`);
  const top = Object.entries(r.habitFreq).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length) para('Mais frequentes: ' + top.map(([id, n]) => `${TASK_LABELS[Number(id)] ?? 'Hábito'} (${n}x)`).join(', ') + '.');
  y += 3;

  section('Assuntos que apareceram');
  para(r.topics.length ? r.topics.join(' · ') : 'Nenhum assunto registrado no período.');
  para(`Conversas no Porto: ${r.conversations}  ·  Registros no diário: ${r.journalCount}`);
  y += 3;

  const st = r.study;
  if (st && st.reviews + st.focusMinutes + st.notes > 0) {
    section('Estudos e foco');
    para(`Revisões de cartões: ${st.reviews}  ·  Minutos de foco: ${st.focusMinutes}  ·  Anotações no Caderno: ${st.notes}`);
    y += 3;
  }

  if (r.letter) {
    section('Leitura da Nórica');
    for (const p of plain(r.letter).split(/\n+/).filter(Boolean)) { para(p, 10, 5); y += 2; }
    y += 1;
  }

  section('Para conversar na consulta');
  para('• O que estava acontecendo nos dias mais difíceis?  • O que ajudou nos dias calmos?  • O que eu quero tentar no próximo mês?');
  y += 4;

  doc.setDrawColor(220, 225, 228);
  doc.line(M, y, W - M, y);
  y += 5;
  doc.setTextColor(120, 130, 135);
  para('Este relatório reúne o que a própria pessoa registrou no app Nórica. Não é diagnóstico nem substitui avaliação profissional. Em crise, ligue 188 (CVV, 24h) ou 192 (SAMU).', 8, 4);

  return doc.output('blob');
}

export default function RelatorioMensal() {
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await noricaApi.monthlyReport();
      const blob = await buildReportPdf(r);
      await shareFile(blob, `norica-relatorio-${r.end}.pdf`, 'Relatório do meu mar');
      setMsg('Relatório pronto. 💚');
    } catch (err: any) {
      const m = String(err?.message || '');
      if (/Pro/i.test(m)) setLocked(true);
      else if (!/cancel/i.test(m)) {
        setMsg('Não foi possível gerar agora. Tente de novo em instantes.');
        reportError(err, 'relatorio-mensal');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-sky-950/60 to-white/5 backdrop-blur-md rounded-[3rem] p-8 text-white shadow-2xl border border-sky-500/20 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-sky-300" />
          <h3 className="text-sm font-black text-sky-300 uppercase tracking-widest">Relatório do mês</h3>
        </div>
        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Pro · PDF</span>
      </div>
      <p className="text-sm text-white/70 font-semibold leading-relaxed">
        Seus últimos 30 dias — humor comparado ao mês anterior, hábitos, estudos e uma leitura da Nórica — em um PDF para levar à terapia.
      </p>
      {locked ? (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-black/25 border border-sky-500/20">
          <Lock size={16} className="text-sky-300 shrink-0 mt-0.5" />
          <p className="text-xs text-white/70 font-semibold leading-relaxed">
            O relatório em PDF faz parte do <Link href="/planos/" className="text-sky-300 font-black underline underline-offset-4">Nórica Pro</Link>.
          </p>
        </div>
      ) : (
        <button onClick={generate} disabled={busy} className="px-5 py-3 rounded-2xl bg-sky-400 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy ? 'Montando o PDF…' : 'Gerar meu PDF'}
        </button>
      )}
      {msg && <p className="text-xs font-bold text-white/60">{msg}</p>}
    </div>
  );
}
