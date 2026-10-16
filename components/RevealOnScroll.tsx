"use client";

// Revelar ao rolar, leve: um IntersectionObserver liga uma classe e o próprio navegador
// faz a transição na placa de vídeo (opacity + translate). Antes era animação por JavaScript
// a cada quadro (framer-motion whileInView), o que travava a rolagem da Início.

import React, { useEffect, useRef, useState } from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  delay?: number; // segundos
  className?: string;
};

let sharedObserver: IntersectionObserver | null = null;
// Cada tela anima a entrada dos cards só na primeira visita da sessão. Ao voltar para ela,
// os cards já aparecem prontos (antes sumiam e voltavam toda vez, parecendo "piscar").
const seenPages = new Set<string>();
const callbacks = new WeakMap<Element, () => void>();

function observe(el: Element, onVisible: () => void) {
  if (typeof IntersectionObserver === 'undefined') { onVisible(); return () => {}; }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          callbacks.get(entry.target)?.();
          callbacks.delete(entry.target);
          sharedObserver?.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  }
  callbacks.set(el, onVisible);
  sharedObserver.observe(el);
  return () => { callbacks.delete(el); sharedObserver?.unobserve(el); };
}

export default function RevealOnScroll({ children, delay = 0, className = '', style, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && seenPages.has(window.location.pathname));

  useEffect(() => {
    if (!ref.current || visible) return;
    const page = window.location.pathname;
    return observe(ref.current, () => { setVisible(true); seenPages.add(page); });
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-in' : ''} ${className}`}
      style={{ ...style, ['--reveal-delay' as any]: `${delay}s` }}
      {...rest}
    >
      {children}
    </div>
  );
}
