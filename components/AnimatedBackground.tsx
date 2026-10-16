"use client";

import React from 'react';
import { Anchor } from 'lucide-react';

interface AnimatedBackgroundProps {
  subtle?: boolean;
  noIcons?: boolean;
}

interface IconInstance {
  id: number;
  top: string;
  left: string;
  rotate: number;
  scale: number;
  size: number;
}

// Posições geradas uma vez só: o fundo fica igual ao trocar de tela
// (antes as âncoras mudavam de lugar a cada página e eram animadas por JavaScript).
function buildIcons(count: number): IconInstance[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return [...Array(count)].map((_, i) => ({
    id: i,
    top: `${rand() * 100}%`,
    left: `${rand() * 100}%`,
    rotate: rand() * 360,
    scale: 0.45 + rand() * 0.55,
    size: 28 + rand() * 25,
  }));
}

const ICONS = buildIcons(14);

const AnimatedBackground = ({ subtle = false, noIcons = false }: AnimatedBackgroundProps) => {
  return (
    <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none ocean-bg">
      {/* Sombra Tecnológica e Malha Abstrata se mexendo (só transform, na placa de vídeo) */}
      <div
        className="absolute inset-[-50%] opacity-40 bg-drift"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.15) 0px, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.08) 0px, transparent 60%),
            radial-gradient(circle at 90% 10%, rgba(244, 63, 94, 0.05) 0px, transparent 40%)
          `,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] opacity-30" />

      {/* Âncoras Flutuantes Suaves */}
      {!noIcons && ICONS.map((icon) => (
        <div
          key={icon.id}
          className="absolute pointer-events-none anchor-float"
          style={{
            top: icon.top,
            left: icon.left,
            animationDuration: `${6 + (icon.id % 3) * 2}s`,
            animationDelay: `${(icon.id % 5) * -0.4}s`,
          }}
        >
          <div
            className={subtle ? 'text-emerald-500/[0.04]' : 'text-emerald-500/[0.08]'}
            style={{ transform: `rotate(${icon.rotate}deg) scale(${icon.scale})` }}
          >
            <Anchor size={icon.size} strokeWidth={3} />
          </div>
        </div>
      ))}

      {/* Partículas de Bolha Subindo */}
      {!noIcons && ICONS.slice(0, 8).map((icon, i) => (
        <div
          key={`bubble-${i}`}
          className="absolute rounded-full bg-white/10 animate-bubble-rise pointer-events-none"
          style={{
            width: `${3 + (i % 3) * 2}px`,
            height: `${3 + (i % 3) * 2}px`,
            left: icon.left,
            animationDelay: `${i * -2.5}s`,
            animationDuration: `${14 + (i % 4) * 4}s`,
          }}
        />
      ))}
    </div>
  );
};

export default React.memo(AnimatedBackground);
