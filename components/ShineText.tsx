"use client";

// Texto com brilho passando, feito só com transform (placa de vídeo).
// Antes o brilho mexia no "background-position" do texto, e o celular redesenhava
// as letras a cada quadro — era o que mais pesava na Início.
// Truque: uma "janela" com máscara de faixa anda para um lado e o texto dentro dela
// anda para o outro na mesma velocidade; as letras ficam paradas e só a faixa clara passa.

import React from 'react';

type Props = {
  children: string;
  base: string;      // cor do texto
  band: string;      // cor da faixa de brilho
  duration?: number; // segundos
  sweep?: 'gap' | 'loop'; // "gap": passa e descansa; "loop": passa sem parar
  reverse?: boolean;
  className?: string;
};

export default function ShineText({ children, base, band, duration = 2.5, sweep = 'gap', reverse = false, className = '' }: Props) {
  const anim = `${sweep === 'gap' ? 'shine' : 'shine-loop'}${reverse ? '-rev' : ''}`;
  return (
    <span className={`shine-text ${className}`} style={{ color: base }}>
      {children}
      <span aria-hidden="true" className="shine-window" style={{ animation: `${anim}-win ${duration}s linear infinite` }}>
        <span className="shine-glyphs" style={{ color: band, animation: `${anim}-glyph ${duration}s linear infinite` }}>{children}</span>
      </span>
    </span>
  );
}
