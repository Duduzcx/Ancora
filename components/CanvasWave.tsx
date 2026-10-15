"use client";

import React, { useEffect, useRef } from 'react';

export default function CanvasWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.5; // Top half
    };
    window.addEventListener('resize', resize);
    resize();

    // Wave parameters - slower and more consistent
    const waves = [
      { color: 'rgba(2, 132, 199, 0.4)', amplitude: 60, speed: 0.008, frequency: 0.005, yOffset: 100 }, // Blue
      { color: 'rgba(249, 115, 22, 0.5)', amplitude: 80, speed: 0.007, frequency: 0.004, yOffset: 120 }, // Orange
      { color: 'rgba(45, 212, 191, 0.3)', amplitude: 50, speed: 0.009, frequency: 0.006, yOffset: 90 },  // Cyan
      { color: 'rgba(56, 189, 248, 0.6)', amplitude: 40, speed: 0.010, frequency: 0.007, yOffset: 110 },  // Light Blue
    ];

    // Initialize particles once outside the draw loop
    const particles = Array.from({ length: 80 }).map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * (window.innerHeight * 0.5),
      speed: 0.1 + Math.random() * 0.4,
      size: Math.random() * 1.5 + 0.5,
      offset: Math.random() * Math.PI * 2
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;

      // Draw volumetric glow behind waves
      const glowGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      );
      glowGrad.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
      glowGrad.addColorStop(0.5, 'rgba(2, 132, 199, 0.05)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw animated flowing lines (pixels moving)
      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        // Compute points for the wave
        for (let x = 0; x <= canvas.width; x += 5) {
          // Add complex sine wave motion
          const y = wave.yOffset 
            + Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude
            + Math.sin(x * wave.frequency * 0.5 - time * wave.speed * 0.5) * (wave.amplitude * 0.5);

          ctx.lineTo(x, y);
        }

        // Connect back to the bottom to create a filled volumetric shape
        ctx.lineTo(canvas.width, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();

        // Create vertical gradient for the wave fill
        const grad = ctx.createLinearGradient(0, 0, 0, 200);
        const baseColor = wave.color.replace(/[\d.]+\)$/g, ''); // Extract rgba(r,g,b, 
        
        grad.addColorStop(0, baseColor + '0.8)');
        grad.addColorStop(1, baseColor + '0)');

        ctx.fillStyle = grad;
        ctx.fill();

        // Draw a bright sharp line on top of the wave (the edge)
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 5) {
          const y = wave.yOffset 
            + Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude
            + Math.sin(x * wave.frequency * 0.5 - time * wave.speed * 0.5) * (wave.amplitude * 0.5);
          if(x===0) ctx.moveTo(x,y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = baseColor + '1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Add moving technological "pixels" / dust particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for (let p = 0; p < particles.length; p++) {
        const part = particles[p];
        part.y -= part.speed;
        
        // Wrap around when reaching top
        if (part.y < 0) {
          part.y = canvas.height;
          part.x = Math.random() * canvas.width;
        }

        ctx.globalAlpha = Math.sin(time * 0.03 + part.offset) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none z-0 opacity-80"
      style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
    />
  );
}
