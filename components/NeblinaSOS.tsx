"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { HelpButton, HelpSheet } from '@/components/AjudaAgora';

interface NeblinaSOSProps {
  onClareou: () => void;
}

// Web Audio API Synth to create high-fidelity, asset-free wind, waves and seagull sounds
class SOSAudioSynth {
  ctx: AudioContext | null = null;
  windGain: GainNode | null = null;
  windFilter: BiquadFilterNode | null = null;
  waveGain: GainNode | null = null;
  waveOsc: OscillatorNode | null = null;
  gullTimer: any = null;

  constructor() {}

  init() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // --- Wind Noise Synth ---
      // Generate white noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      // Lowpass filter to muffle the wind
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(200, this.ctx.currentTime); // muffled

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      noiseNode.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      noiseNode.start();

      // --- Wave Ocean Hum Synth ---
      this.waveOsc = this.ctx.createOscillator();
      this.waveOsc.type = 'sine';
      this.waveOsc.frequency.setValueAtTime(70, this.ctx.currentTime); // low hum

      this.waveGain = this.ctx.createGain();
      this.waveGain.gain.setValueAtTime(0.01, this.ctx.currentTime); // quiet initially

      this.waveOsc.connect(this.waveGain);
      this.waveGain.connect(this.ctx.destination);
      this.waveOsc.start();

      // Swelling wave loop
      const animateWaves = () => {
        if (!this.ctx || this.ctx.state === 'closed') return;
        const now = this.ctx.currentTime;
        
        // Simulates periodic low ocean swells (every 5 seconds)
        this.waveGain?.gain.setValueAtTime(this.waveGain.gain.value, now);
        this.waveGain?.gain.linearRampToValueAtTime(0.05, now + 2.5);
        this.waveGain?.gain.linearRampToValueAtTime(0.01, now + 5.0);

        this.waveOsc?.frequency.setValueAtTime(70, now);
        this.waveOsc?.frequency.linearRampToValueAtTime(74, now + 2.5);
        this.waveOsc?.frequency.linearRampToValueAtTime(70, now + 5.0);

        this.gullTimer = setTimeout(animateWaves, 5000);
      };
      animateWaves();

      // Periodic seagull calls as the fog clears
      const triggerSeagulls = () => {
        if (!this.ctx || this.ctx.state === 'closed') return;
        if (this.waveGain && this.waveGain.gain.value > 0.02) {
          this.playSeagullChirp();
        }
        // Gull call every 9-16 seconds
        this.gullTimer = setTimeout(triggerSeagulls, 9000 + Math.random() * 7000);
      };
      triggerSeagulls();

    } catch (e) {
      console.error("AudioContext initialization failed", e);
    }
  }

  playSeagullChirp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Dynamic pitch sweep to simulate gull chirp
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.3);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  update(progress: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Wind: fades out and gets slightly brighter
    if (this.windFilter) {
      const freq = 200 + progress * 400; // 200Hz -> 600Hz
      this.windFilter.frequency.setTargetAtTime(freq, now, 0.1);
    }
    if (this.windGain) {
      const vol = 0.25 * (1 - progress);
      this.windGain.gain.setTargetAtTime(vol, now, 0.1);
    }

    // Waves: get louder/cleaner
    if (this.waveGain) {
      const targetVol = 0.01 + progress * 0.07;
      this.waveGain.gain.setTargetAtTime(targetVol, now, 0.3);
    }
  }

  stop() {
    if (this.ctx) {
      clearTimeout(this.gullTimer);
      this.ctx.close().catch(() => {});
    }
  }
}

// Sub-componente para gerenciar os dois vídeos em crossfade de forma precisa
function SeamlessVideo({ src }: { src: string }) {
  const v1Ref = useRef<HTMLVideoElement>(null);
  const v2Ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(1);

  useEffect(() => {
    const checkLoop = setInterval(() => {
      const v1 = v1Ref.current;
      const v2 = v2Ref.current;
      if (!v1 || !v2) return;

      const current = active === 1 ? v1 : v2;
      const next = active === 1 ? v2 : v1;

      // Se o atual está chegando ao fim (faltando 0.6s para uma transição bem suave)
      if (current.duration > 0 && current.duration - current.currentTime < 0.6) {
        if (next.paused) {
          next.currentTime = 0;
          next.play().catch(() => {});
          setActive(active === 1 ? 2 : 1);
        }
      }
    }, 50); // Checa a cada 50ms para precisão maxima

    return () => clearInterval(checkLoop);
  }, [active]);

  return (
    <div className="absolute inset-0 z-0">
      <video 
        ref={v1Ref}
        autoPlay 
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1000ms] brightness-[0.4]"
        style={{ opacity: active === 1 ? 1 : 0 }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <video 
        ref={v2Ref}
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1000ms] brightness-[0.4]"
        style={{ opacity: active === 2 ? 1 : 0 }}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

export default function NeblinaSOS({ onClareou }: NeblinaSOSProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioSynthRef = useRef<SOSAudioSynth | null>(null);
  const [isCleared, setIsCleared] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [rubCount, setRubCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Efeito de névoa texturizada
    ctx.fillStyle = '#2d3748'; // Cor base da névoa
    ctx.globalAlpha = 0.95;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = '#4a5568';
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 100, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalCompositeOperation = 'destination-out';
  }, []);

  // Initialize and clean up Web Audio Synthesizer
  useEffect(() => {
    audioSynthRef.current = new SOSAudioSynth();
    audioSynthRef.current.init();

    return () => {
      if (audioSynthRef.current) {
        audioSynthRef.current.stop();
      }
    };
  }, []);

  const handleEsfregar = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isCleared) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    ctx.beginPath();
    ctx.arc(x, y, 55, 0, Math.PI * 2);
    ctx.fill();

    setRubCount(prev => {
      const newCount = prev + 1;
      
      // 1. Throttled Haptic Feedback during rubbing
      if (newCount % 12 === 0) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }

      // 2. Update Web Audio progress
      const progress = Math.min(newCount / 250, 1);
      if (audioSynthRef.current) {
        audioSynthRef.current.update(progress);
      }
      
      // 3. Clear trigger
      if (newCount > 250 && !isCleared) {
        setIsCleared(true);
        // Warm success vibration ("you are safe, arrived")
        Haptics.vibrate({ duration: 450 }).catch(() => {});
      }
      return newCount;
    });
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black overflow-hidden flex items-center justify-center">
      
      <SeamlessVideo src="/mar.mp4" />

      {/* CAMADA 1.5: METÁFORA DO FAROL (Luz guiando no fundo com ritmo de respiração 4s/4s) */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        {/* Rotating Lighthouse Beacon Beam */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          className="absolute w-[180%] h-[180%] bg-[conic-gradient(from_0deg,transparent_40%,rgba(253,244,210,0.18)_50%,transparent_60%)]"
        />

        {/* Breathing Guide Radial Glow */}
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.15, 0.65, 0.15],
          }}
          transition={{
            duration: 8, // 4s inhale, 4s exhale
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute w-80 h-80 rounded-full bg-amber-200/20 blur-[75px]"
        />
        
        {/* Breathing guide text */}
        {!isCleared && (
          <motion.div
            animate={{
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-24 z-30 text-center text-white/50 text-[9px] font-black uppercase tracking-[0.35em]"
          >
            Sincronize sua respiração com a luz
          </motion.div>
        )}
      </div>

      {/* CAMADA 2: SOMBRA DE RODAPÉ (GROUNDING) */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-15" />

      {/* CAMADA 3: CANVAS DA NEBLINA */}
      <AnimatePresence>
        {!isCleared && (
          <motion.canvas
            ref={canvasRef}
            onTouchMove={handleEsfregar}
            exit={{ opacity: 0, filter: 'blur(20px)' }}
            transition={{ duration: 2.5 }}
            className="absolute inset-0 z-20 cursor-none touch-none"
          />
        )}
      </AnimatePresence>

      {/* INTERFACE PÓS-LIMPEZA */}
      {isCleared && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-50 p-8 rounded-[40px] bg-black/40 backdrop-blur-xl border border-white/20 text-center max-w-xs shadow-2xl mx-6"
        >
          <h2 className="text-3xl font-bold text-white mb-4">Horizonte à vista</h2>
          <p className="text-gray-200 mb-8 font-medium">A tempestade deu trégua. O Porto seguro espera por ti.</p>
          <button 
            onClick={onClareou}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-emerald-900/40"
          >
            Entrar no Porto
          </button>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-full mt-3 py-4 rounded-2xl border border-white/20 bg-white/10 text-white font-black uppercase tracking-widest text-[10px]"
          >
            Ainda não estou bem — falar com alguém
          </button>
        </motion.div>
      )}

      {/* AJUDA HUMANA: sempre ao alcance durante o S.O.S (CVV 188 / SAMU 192) */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 z-[60]">
        <HelpButton dark onClick={() => setIsHelpOpen(true)} />
      </div>
      <HelpSheet open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {!isCleared && (
        <div className="absolute top-1/3 z-30 text-center w-full pointer-events-none px-6">
          <p className="text-white/60 text-lg font-black tracking-[0.3em] uppercase animate-pulse italic">
            Limpa o horizonte...
          </p>
        </div>
      )}
    </div>
  );
}
