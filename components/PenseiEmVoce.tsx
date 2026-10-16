"use client";

// "Pensei em você": um cartão bonito com uma frase de cuidado para mandar a um amigo.
// A imagem é desenhada no próprio celular e vai pelo menu de compartilhar (WhatsApp etc.).

import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { shareFile } from '@/lib/share-file';
import { shareText, STORE_URL } from '@/lib/share-text';

const PHRASES = [
  'Passei só para dizer: pensei em você hoje.',
  'Você não precisa dar conta de tudo. Estou por aqui.',
  'Orgulho de você, mesmo nos dias difíceis.',
  'Se o dia pesar, me chama. Sério.',
  'Respira. Você já atravessou tempestades antes.',
  'Obrigado(a) por existir na minha vida.',
];
const THEMES = [
  { a: '#064e3b', b: '#0e7490', ink: '#ecfeff' },
  { a: '#4c1d95', b: '#be185d', ink: '#fdf2f8' },
  { a: '#1e3a8a', b: '#0f766e', ink: '#f0fdfa' },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function drawCard(phrase: string, theme: (typeof THEMES)[number], from: string): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 1080, 1350);
  g.addColorStop(0, theme.a); g.addColorStop(1, theme.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (const [x, y, r] of [[900, 180, 220], [140, 1200, 260], [980, 1150, 120]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = theme.ink;
  ctx.font = '600 44px sans-serif';
  ctx.fillText('💛', 110, 300);
  ctx.font = '800 78px sans-serif';
  const lines = wrap(ctx, phrase, 860);
  lines.forEach((l, i) => ctx.fillText(l, 110, 450 + i * 100));
  ctx.font = '600 40px sans-serif';
  ctx.globalAlpha = 0.85;
  if (from) ctx.fillText(`— ${from}`, 110, 450 + lines.length * 100 + 60);
  ctx.globalAlpha = 0.6;
  ctx.font = '700 32px sans-serif';
  ctx.fillText('Nórica · seu porto seguro', 110, 1250);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('cartão'))), 'image/png'));
}

export default function PenseiEmVoce({ from = '' }: { from?: string }) {
  const [phrase, setPhrase] = useState(PHRASES[0]);
  const [theme, setTheme] = useState(0);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const blob = await drawCard(phrase, THEMES[theme], from);
      await shareFile(blob, 'pensei-em-voce.png', 'Pensei em você');
    } catch (_e) {
      await shareText(`${phrase}${from ? ` — ${from}` : ''} 💛\n\n(feito na Nórica: ${STORE_URL})`, 'Pensei em você');
    } finally {
      setBusy(false);
    }
  };
  const t = THEMES[theme];
  return (
    <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-4" data-testid="pensei">
      <p className="text-[10px] font-black text-rose-200/80 uppercase tracking-widest">Pensei em você</p>
      <div className="rounded-[1.5rem] p-6 aspect-[4/5] flex flex-col justify-center" style={{ background: `linear-gradient(135deg, ${t.a}, ${t.b})`, color: t.ink }}>
        <p className="text-2xl font-black leading-snug">{phrase}</p>
        {from && <p className="text-sm font-bold opacity-80 mt-3">— {from}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {PHRASES.map((p) => (
          <button key={p} onClick={() => setPhrase(p)} className={`px-3 py-1.5 rounded-full border text-[11px] font-bold text-left ${phrase === p ? 'bg-rose-400/20 border-rose-300/40 text-rose-50' : 'border-white/10 text-white/55'}`}>{p}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {THEMES.map((th, i) => (
          <button key={i} onClick={() => setTheme(i)} aria-label={`Cor ${i + 1}`} className={`w-9 h-9 rounded-full border-2 ${theme === i ? 'border-white' : 'border-transparent'}`} style={{ background: `linear-gradient(135deg, ${th.a}, ${th.b})` }} />
        ))}
        <button onClick={send} disabled={busy} className="ml-auto px-5 py-3 rounded-2xl bg-rose-400 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
        </button>
      </div>
    </section>
  );
}
