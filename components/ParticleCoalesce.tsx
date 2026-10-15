"use client";

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionTemplate } from 'framer-motion';

interface ParticleCoalesceProps {
  children: React.ReactNode;
  className?: string;
}

// Generate random particles (different shapes/geometry)
const particlesData = Array.from({ length: 28 }).map((_, i) => {
  const angle = Math.random() * Math.PI * 2;
  const distance = 160 + Math.random() * 240;
  return {
    id: i,
    startX: Math.cos(angle) * distance,
    startY: Math.sin(angle) * distance,
    size: 4 + Math.random() * 6,
    color: i % 4 === 0 ? '#00D88B' : i % 4 === 1 ? '#0ea5e9' : i % 4 === 2 ? '#a855f7' : '#10b981',
    shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'diamond' : 'square',
    // Slight variation in speed/offset mapping
    coalesceStart: Math.random() * 0.15, // starts coalescing at 0% to 15% scroll
    coalesceEnd: 0.7 + Math.random() * 0.2, // finishes at 70% to 90% scroll
  };
});

export default function ParticleCoalesce({ children, className = "" }: ParticleCoalesceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Monitor scroll progress relative to this specific container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"] // starts when top enters viewport, ends when center reaches middle
  });

  // Card transform bindings based on scroll progress
  const y = useTransform(scrollYProgress, [0, 1], [150, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.72, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.4, 1], [0, 0.5, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [30, 0]);
  
  // Brightness morphing via motion values and template
  const brightnessVal = useTransform(scrollYProgress, [0, 1], [1.8, 1]);
  const filter = useMotionTemplate`brightness(${brightnessVal})`;

  // Pulsing border opacity linked to scroll
  const borderOpacity = useTransform(scrollYProgress, [0, 1], [0, 0.4]);

  return (
    <div ref={containerRef} className="relative w-full py-4 overflow-visible" style={{ perspective: 1200 }}>
      
      {/* Particle Swarm bound to Scroll */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-visible flex items-center justify-center">
        {particlesData.map((p) => {
          let borderRadius = "50%";
          let initialRotate = 0;
          if (p.shape === 'diamond') {
            borderRadius = "2px";
            initialRotate = 45;
          } else if (p.shape === 'square') {
            borderRadius = "4px";
          }

          // Compute individual transforms bound to scroll
          // Each particle can coalesce at slightly different rates
          const px = useTransform(scrollYProgress, [p.coalesceStart, p.coalesceEnd], [p.startX, 0]);
          const py = useTransform(scrollYProgress, [p.coalesceStart, p.coalesceEnd], [p.startY, 0]);
          const pScale = useTransform(scrollYProgress, [p.coalesceStart, p.coalesceEnd], [1.8, 0.05]);
          const pOpacity = useTransform(scrollYProgress, [p.coalesceStart, p.coalesceEnd / 1.5, p.coalesceEnd], [0.8, 0.7, 0]);
          const pRotate = useTransform(scrollYProgress, [p.coalesceStart, p.coalesceEnd], [initialRotate, initialRotate + 360]);

          return (
            <motion.div
              key={p.id}
              style={{
                x: px,
                y: py,
                scale: pScale,
                opacity: pOpacity,
                rotate: pRotate,
                width: p.size,
                height: p.size,
                borderRadius: borderRadius,
                backgroundColor: p.color,
                color: p.color,
                filter: "drop-shadow(0 0 8px currentColor) brightness(1.5)",
                willChange: "transform, opacity",
              }}
              className="absolute pointer-events-none"
            />
          );
        })}
      </div>

      {/* Main Content Card with Scroll-Linked transform properties */}
      <motion.div
        style={{
          y,
          scale,
          opacity,
          rotateX,
          filter,
          transformPerspective: 1200,
          transformStyle: "preserve-3d",
          willChange: "transform, opacity, filter",
        }}
        className={className}
      >
        {/* Animated glowing border frame linked to scroll */}
        <motion.div 
          style={{ opacity: borderOpacity }}
          className="absolute -inset-[1px] bg-gradient-to-r from-[#00D88B]/60 via-sky-500/40 to-[#00D88B]/60 rounded-[2.5rem] -z-10 blur-[2px]" 
        />
        
        {children}
      </motion.div>
    </div>
  );
}
