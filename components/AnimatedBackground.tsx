"use client";

import React, { useEffect, useState } from 'react';
import { Anchor } from 'lucide-react';
import { motion } from 'framer-motion';

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
  stroke: number;
}

const AnimatedBackground = ({ subtle = false, noIcons = false }: AnimatedBackgroundProps) => {
  const [icons, setIcons] = useState<IconInstance[]>([]);

  useEffect(() => {
    if (noIcons) return;
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 14 : 21;
    setIcons([...Array(count)].map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      rotate: Math.random() * 360,
      scale: 0.45 + Math.random() * 0.55,
      size: 28 + Math.random() * 25,
      stroke: 3.0,
    })));
  }, [noIcons]);

  return (
    <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none ocean-bg">
      
      {/* Sombra Tecnológica e Malha Abstrata se mexendo */}
      <motion.div 
        className="absolute inset-[-50%] opacity-40 mix-blend-screen" 
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.15) 0px, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.08) 0px, transparent 60%),
            radial-gradient(circle at 90% 10%, rgba(244, 63, 94, 0.05) 0px, transparent 40%)
          `
        }}
        animate={{
          rotate: [0, 8, -8, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] opacity-30" />

      {/* Âncoras Flutuantes Suaves (GPU Aceleradas) */}
      {!noIcons && icons.map((icon) => (
        <motion.div
          key={icon.id}
          className="absolute pointer-events-none"
          style={{ 
            top: icon.top,
            left: icon.left,
          }}
          animate={{
            y: [0, -15, 0],
            rotate: [icon.rotate, icon.rotate + 6, icon.rotate],
            scale: [icon.scale, icon.scale, icon.scale],
          }}
          transition={{
             duration: 6 + (icon.id % 3) * 2,
             repeat: Infinity,
             ease: "easeInOut",
             delay: (icon.id % 5) * 0.4
          }}
        >
          <div 
            className={`${subtle ? 'text-emerald-500/[0.04]' : 'text-emerald-500/[0.08]'}`}
            style={{ 
              filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.05))',
            }}
          >
            <Anchor size={icon.size} strokeWidth={icon.stroke} />
          </div>
        </motion.div>
      ))}

      {/* Partículas de Bolha Subindo (GPU Aceleradas) */}
      {icons.slice(0, 8).map((icon, i) => (
        <div
          key={`bubble-${i}`}
          className="absolute rounded-full bg-white/10 blur-[1px] animate-bubble-rise pointer-events-none"
          style={{
            width: `${3 + (i % 3) * 2}px`,
            height: `${3 + (i % 3) * 2}px`,
            left: icon.left,
            animationDelay: `${i * -2.5}s`, // Delay negativo inicia a animação em pontos diferentes do ciclo
            animationDuration: `${14 + (i % 4) * 4}s`,
          }}
        />
      ))}
    </div>
  );
};

export default React.memo(AnimatedBackground);
