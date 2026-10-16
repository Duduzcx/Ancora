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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    return observe(ref.current, () => setVisible(true));
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
