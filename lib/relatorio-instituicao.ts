"use client";

// Relatório mensal da instituição (B2B) em PDF, montado no próprio aparelho
// a partir dos números somados e anônimos do painel.

import type { OrgDashboard } from '@/lib/norica-api';
import { MOOD_COLOR, MOOD_LABEL } from '@/lib/farol';

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as any;

export async function buildOrgReportPdf(d: OrgDashboard): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = 0;

  doc.setFillColor(2, 16, 19);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(52, 211, 153);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('NÓRICA  ·  RELATÓRIO DA INSTITUIÇÃO', M, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(d.org, M, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 200);
  doc.text(`Últimas 4 semanas  ·  gerado em ${new Date().toLocaleDateString('pt-BR')}${d.demo ? '  ·  DEMONSTRAÇÃO (números fictícios)' : ''}`, M, 29);
  y = 44;

  const section = (title: string) => {
    if (y > 255) { doc.addPage(); y = 20; }
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

  section('Visão geral');
  para(`Participantes: ${d.members}  ·  Ativos na semana: ${d.current?.active ?? 'menos de ' + d.minGroup}`);
  if (d.current && d.members) para(`Adesão: ${Math.round((100 * d.current.active) / d.members)}% dos participantes usaram a Nórica nesta semana.`);
  if (d.current) {
    para(`Tiveram algum dia difícil: ${d.current.hardPeoplePct}%${d.previous ? ` (semana anterior: ${d.previous.hardPeoplePct}%)` : ''}  ·  Cuidaram de si nos Logs: ${d.current.logsPct}%`);
    y += 2;
    // Barra empilhada do humor
    let x = M;
    const total = W - 2 * M;
    for (const k of Object.keys(MOOD_LABEL) as (keyof typeof MOOD_LABEL)[]) {
      const w = (total * (d.current.moodPct[k] ?? 0)) / 100;
      if (w > 0) { doc.setFillColor(...hex(MOOD_COLOR[k])); doc.rect(x, y, Math.max(w - 0.6, 0.2), 6, 'F'); x += w; }
    }
    y += 10;
    let lx = M;
    doc.setFontSize(8);
    for (const k of Object.keys(MOOD_LABEL) as (keyof typeof MOOD_LABEL)[]) {
      doc.setFillColor(...hex(MOOD_COLOR[k]));
      doc.rect(lx, y - 2.6, 3, 3, 'F');
      doc.setTextColor(60, 70, 75);
      const t = `${MOOD_LABEL[k]} ${d.current.moodPct[k] ?? 0}%`;
      doc.text(t, lx + 4.5, y);
      lx += doc.getTextWidth(t) + 11;
    }
    y += 8;
    if (d.current.topics.length) para('Assuntos mais presentes: ' + d.current.topics.map((t) => `${t.topic} (${t.pct}%)`).join(', ') + '.');
  } else {
    para(`Menos de ${d.minGroup} pessoas ativas nesta semana: números ocultos para proteger o anonimato.`);
  }
  y += 3;

  section('Evolução (pessoas com algum dia difícil)');
  const chartH = 30, colW = (W - 2 * M) / d.weeks.length;
  d.weeks.forEach((w, i) => {
    const x = M + i * colW;
    if (w.hardPeoplePct !== null) {
      const h = (chartH * w.hardPeoplePct) / 100;
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(x + colW * 0.25, y + chartH - h, colW * 0.5, h, 1, 1, 'F');
      doc.setFontSize(8);
      doc.setTextColor(60, 70, 75);
      doc.text(`${w.hardPeoplePct}%`, x + colW * 0.5, y + chartH - h - 1.5, { align: 'center' });
    }
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 135);
    doc.text(w.label, x + colW * 0.5, y + chartH + 5, { align: 'center' });
  });
  y += chartH + 12;

  if (d.sectors.length) {
    section(`Por ${d.sectorLabel.toLowerCase()}`);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 135);
    const cols = [M, M + 60, M + 85, M + 112, M + 137, M + 160];
    ['Grupo', 'Ativos', 'Dia difícil', 'Ansioso', 'Nos Logs', 'Variação'].forEach((h, i) => doc.text(h, cols[i], y));
    y += 5;
    doc.setTextColor(40, 50, 55);
    doc.setFontSize(9);
    for (const r of d.sectors) {
      if (y > 280) { doc.addPage(); y = 20; }
      const c = r.current;
      const diff = c && r.previous ? c.hardPeoplePct - r.previous.hardPeoplePct : null;
      [r.name.slice(0, 28), c ? String(c.active) : 'oculto', c ? `${c.hardPeoplePct}%` : '—', c ? `${c.moodPct.ansioso ?? 0}%` : '—', c ? `${c.logsPct}%` : '—', diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff} pts`]
        .forEach((v, i) => doc.text(v, cols[i], y));
      y += 6;
    }
    y += 3;
  }

  if (d.alerts.length) {
    section('Pontos de atenção');
    for (const a of d.alerts) para(`• ${a}`);
    y += 3;
  }
  if (d.actions.length) {
    section('Ações sugeridas');
    for (const a of d.actions) para(`• ${a}`);
    y += 3;
  }
  if (d.campaigns?.length) {
    section('Campanhas no período');
    for (const c of d.campaigns) para(`• ${c.title} (${c.starts_on.split('-').reverse().join('/')} a ${c.ends_on.split('-').reverse().join('/')})`);
    y += 3;
  }

  doc.setDrawColor(220, 225, 228);
  doc.line(M, y, W - M, y);
  y += 5;
  doc.setTextColor(120, 130, 135);
  para('Números somados e anônimos: grupos com menos de 5 pessoas ativas não aparecem e temas só contam com 3 ou mais pessoas. Nenhuma conversa, diário ou dado individual é compartilhado. Não é diagnóstico. Canais de ajuda: CVV 188 (24h, gratuito) e SAMU 192.', 8, 4);

  return doc.output('blob');
}
