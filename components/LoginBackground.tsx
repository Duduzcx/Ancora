"use client";

import React from 'react';
import { motion } from 'framer-motion';
import CanvasWave from './CanvasWave';

export default function LoginBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#080d19] pointer-events-none">
      
      {/* Grade Abstrata de Fundo Escura */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] opacity-30" />

      {/* Sombras 3D Fluidas Profissionais (Canvas 60fps) */}
      <CanvasWave />

      {/* Luzes dinâmicas flutuando sobre a sombra para dar vida (Sem blur para não bugar) */}
      <motion.div
        className="absolute top-[10%] left-[10%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)'
        }}
        animate={{
          x: [0, 60, 0],
          y: [0, -30, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[5%] right-[5%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%)'
        }}
        animate={{
          x: [0, -50, 0],
          y: [0, 40, 0],
          scale: [1, 1.15, 1]
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Sombras Tecnológicas base se movendo lentamente pelo fundo */}
      <motion.div 
        className="absolute inset-[-50%] opacity-60 pointer-events-none" 
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 70%, rgba(16, 185, 129, 0.3) 0px, transparent 40%),
            radial-gradient(circle at 75% 80%, rgba(59, 130, 246, 0.2) 0px, transparent 40%)
          `
        }}
        animate={{
          rotate: [0, 5, -5, 0],
        }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Brilho adicional no topo para dar destaque extremo */}
      <div className="absolute top-0 inset-x-0 h-[25vh] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.15),transparent)] opacity-90 pointer-events-none" />
      
    </div>
  );
}
