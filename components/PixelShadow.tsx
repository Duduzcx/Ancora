"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function PixelShadow() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#050810]">
      {/* Padrão de ancoras substituindo as bolinhas */}
      <motion.div 
        className="absolute inset-0" 
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='5' r='3'/%3E%3Cline x1='12' y1='22' x2='12' y2='8'/%3E%3Cpath d='M5 12H2a10 10 0 0 0 20 0h-3'/%3E%3C/svg%3E\")",
          backgroundSize: '32px 32px'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '32px 32px'],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Sombra tecnológica brilhante 1 (Indigo/Blue) */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.4, 0.3],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[10%] w-[120vw] h-[120vw] max-w-[800px] max-h-[800px] bg-indigo-600/30 blur-[100px] rounded-full"
        style={{ willChange: 'transform, opacity' }}
      />

      {/* Sombra tecnológica brilhante 2 (Emerald/Cyan) */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[10%] right-[5%] w-[100vw] h-[100vw] max-w-[600px] max-h-[600px] bg-[#00D88B]/20 blur-[100px] rounded-full"
        style={{ willChange: 'transform, opacity' }}
      />
      
      {/* Sombra tecnológica brilhante 3 (Cyan sutil para dar volume) */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.3, 0.15]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] bg-cyan-500/20 blur-[100px] rounded-full"
        style={{ willChange: 'transform, opacity' }}
      />
    </div>
  );
}
