"use client";

// Abertura do app: o mar se acalma, a âncora desce, "Nórica" sobe letra por letra
// e a cortina de água sobe revelando a Início. Tudo com transform/opacity (placa de vídeo).
// Aparece uma vez por abertura do app; um toque pula.

import React, { useEffect, useState } from 'react';
import { Anchor } from 'lucide-react';

const MIN_MS = 1500;    // tempo mínimo da animação de entrada
const SETTLE_MS = 350;  // espera a Início terminar de montar antes da cortina subir (sem travar)
const EXIT_MS = 800;    // a cortina subindo
const KEY = 'norica-abertura';
const WORD = 'Nórica';
const BUBBLES = [
  { l: 12, s: 6, d: 0.0, t: 3.4 }, { l: 24, s: 4, d: 0.5, t: 2.8 }, { l: 37, s: 8, d: 0.2, t: 3.8 },
  { l: 52, s: 5, d: 0.9, t: 3.0 }, { l: 63, s: 7, d: 0.3, t: 3.6 }, { l: 74, s: 4, d: 0.7, t: 2.6 },
  { l: 86, s: 6, d: 0.1, t: 3.2 }, { l: 45, s: 3, d: 1.1, t: 2.4 }, { l: 18, s: 3, d: 1.3, t: 2.9 },
];

export default function AberturaNorica({ ready }: { ready: boolean }) {
  // Só na primeira vez nesta abertura do app (voltar de outra tela não repete).
  const [show] = useState(() => {
    try { return sessionStorage.getItem(KEY) !== '1'; } catch (_e) { return true; }
  });
  const [minDone, setMinDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(!show);

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (_e) {}
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setMinDone(true), reduce ? 400 : MIN_MS);
    return () => clearTimeout(t);
  }, [show]);

  // A Início monta por baixo assim que o app fica pronto; a cortina só sobe depois que
  // ela terminou de montar (a animação não divide o celular com o trabalho de montar a tela).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    if (!show || leaving || !(minDone && settled)) return;
    requestAnimationFrame(() => requestAnimationFrame(() => setLeaving(true)));
  }, [minDone, settled, show, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), EXIT_MS + 50);
    return () => clearTimeout(t);
  }, [leaving]);

  // Enquanto o app ainda carrega (sem abertura nesta sessão), um fundo liso evita piscar.
  if (gone) {
    return ready ? null : <div className="fixed inset-0 z-[9999] bg-[#021013]" aria-hidden="true" />;
  }

  return (
    <div
      className={`abertura ${leaving ? 'is-leaving' : ''}`}
      onClick={() => { if (ready) setLeaving(true); }}
      role="presentation"
      data-testid="abertura"
    >
      <div className="abertura-agua">
        {/* luz do fundo */}
        <div className="abertura-luz" />
        {/* bolhas subindo */}
        {BUBBLES.map((b, i) => (
          <span key={i} className="abertura-bolha" style={{ left: `${b.l}%`, width: b.s, height: b.s, animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }} />
        ))}

        <div className="abertura-centro">
          {/* ondas na água quando a âncora chega */}
          <span className="abertura-anel" style={{ animationDelay: '0.55s' }} />
          <span className="abertura-anel" style={{ animationDelay: '0.85s' }} />
          <span className="abertura-anel" style={{ animationDelay: '1.15s' }} />
          <div className="abertura-ancora">
            <Anchor size={46} strokeWidth={2.4} />
          </div>
        </div>

        <h1 className="abertura-nome" aria-label={WORD}>
          {WORD.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.75 + i * 0.07}s` }}>{c}</span>
          ))}
        </h1>
        <p className="abertura-frase">respire. você chegou.</p>

        {/* borda de onda que acompanha a cortina subindo */}
        <svg className="abertura-onda" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,40 C240,100 480,0 720,40 C960,80 1200,10 1440,50 L1440,0 L0,0 Z" fill="#021013" />
          <path d="M0,30 C260,90 520,-5 760,35 C1000,75 1220,5 1440,40 L1440,0 L0,0 Z" fill="rgba(45,212,191,0.10)" />
        </svg>
      </div>
    </div>
  );
}
