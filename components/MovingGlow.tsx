"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function MovingGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none">
      {/* Orb 1: Aqua/Emerald (Brand Color #00D88B) - Bottom Right area */}
      <motion.div
        initial={{ x: '10%', y: '20%', scale: 1 }}
        animate={{
          x: ['10%', '35%', '-5%', '10%'],
          y: ['20%', '45%', '15%', '20%'],
          scale: [1, 1.3, 0.85, 1],
          opacity: [0.4, 0.7, 0.5, 0.4],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[-10%] right-[-15%] w-[350px] h-[350px] md:w-[650px] md:h-[650px] rounded-full bg-[#00D88B]/40 blur-[80px] md:blur-[135px]"
        style={{ willChange: "transform, opacity" }}
      />

      {/* Orb 2: Deep Teal - Top Left/Center area */}
      <motion.div
        initial={{ x: '-15%', y: '-10%', scale: 1.1 }}
        animate={{
          x: ['-15%', '20%', '-25%', '-15%'],
          y: ['-10%', '15%', '5%', '-10%'],
          scale: [1.1, 0.9, 1.25, 1.1],
          opacity: [0.35, 0.6, 0.4, 0.35],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[-10%] left-[-15%] w-[380px] h-[380px] md:w-[700px] md:h-[700px] rounded-full bg-teal-500/35 blur-[90px] md:blur-[140px]"
        style={{ willChange: "transform, opacity" }}
      />

      {/* Orb 3: Cyan/Mint Green - Center Right area */}
      <motion.div
        initial={{ x: '25%', y: '5%', scale: 0.9 }}
        animate={{
          x: ['25%', '-10%', '20%', '25%'],
          y: ['5%', '25%', '-15%', '5%'],
          scale: [0.9, 1.2, 0.8, 0.9],
          opacity: [0.3, 0.55, 0.35, 0.3],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[25%] right-[-10%] w-[300px] h-[300px] md:w-[550px] md:h-[550px] rounded-full bg-cyan-500/30 blur-[75px] md:blur-[120px]"
        style={{ willChange: "transform, opacity" }}
      />
    </div>
  );
}
