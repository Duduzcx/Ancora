"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';

interface MensagemIAProps {
  textoOriginal: string;
  isStreaming?: boolean;
  shouldAnimate?: boolean;
  cancelarRef?: React.MutableRefObject<boolean>;
  onFinalizado?: () => void;
}

export function MensagemIA({ 
  textoOriginal, 
  isStreaming = false, 
  shouldAnimate = true,
  cancelarRef,
  onFinalizado
}: MensagemIAProps) {
  const [textoExibido, setTextoExibido] = useState('');
  const [digitando, setDigitando] = useState(shouldAnimate);
  
  const wordsRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  
  const isStreamingRef = useRef(isStreaming);
  const onFinalizadoRef = useRef(onFinalizado);

  // Sync refs to avoid restarting the interval when props change
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    onFinalizadoRef.current = onFinalizado;
  }, [onFinalizado]);

  // Sync incoming text stream to wordsRef
  useEffect(() => {
    if (!shouldAnimate) {
      setTextoExibido(textoOriginal);
      setDigitando(false);
      return;
    }
    
    // Split the current original text into words
    wordsRef.current = textoOriginal ? textoOriginal.split(' ') : [];
  }, [textoOriginal, shouldAnimate]);

  const [isFinished, setIsFinished] = useState(false);

  // The animation interval effect
  useEffect(() => {
    if (!shouldAnimate) return;

    // Reset animation state when first starting
    setTextoExibido('');
    setDigitando(true);
    setIsFinished(false);
    currentIndexRef.current = 0;

    const velocidadePalavra = 40; // 40ms per word

    const intervalo = setInterval(async () => {
      // 1. Check if user clicked cancel
      if (cancelarRef?.current) {
        clearInterval(intervalo);
        setDigitando(false);
        setIsFinished(true);
        if (onFinalizadoRef.current) onFinalizadoRef.current();
        return;
      }

      const words = wordsRef.current;
      const currentIndex = currentIndexRef.current;

      if (currentIndex < words.length) {
        // We have words to animate
        const nextWords = words.slice(0, currentIndex + 1);
        setTextoExibido(nextWords.join(' '));
        currentIndexRef.current = currentIndex + 1;

        // Textured haptics: every 4 words
        if ((currentIndex + 1) % 4 === 0) {
          try { await Haptics.selectionStart(); } catch (e) {} // Vibração ultra leve
        }
      } else {
        // We have animated all words currently available
        // If we are no longer streaming, we are fully done!
        if (!isStreamingRef.current) {
          clearInterval(intervalo);
          setDigitando(false);
          setIsFinished(true);
          if (onFinalizadoRef.current) onFinalizadoRef.current();

          // Light haptic on completion
          Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        }
      }
    }, velocidadePalavra);

    return () => clearInterval(intervalo);
  }, [shouldAnimate, cancelarRef]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: digitando ? 0.85 : 1, 
        y: 0,
        scale: isFinished && shouldAnimate ? [1, 1.01, 1] : 1
      }}
      transition={{ duration: 0.3 }}
      className="relative p-6 rounded-3xl rounded-tl-sm text-sm leading-relaxed drop-shadow-sm border bg-[#1a2333]/95 border-white/5 backdrop-blur-xl text-slate-100 max-w-[85%] mr-auto"
    >
      <div className="leading-relaxed text-[15px] tracking-wide w-full">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          className="prose prose-invert prose-p:my-2 prose-strong:text-emerald-400 prose-strong:font-semibold max-w-none break-words text-[15px] leading-relaxed prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5 prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5 prose-li:my-1 prose-a:text-sky-400 prose-headings:text-white prose-headings:font-bold"
        >
          {textoExibido}
        </ReactMarkdown>
        {digitando && (
          <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-400 animate-pulse align-middle rounded-sm"></span>
        )}
      </div>
    </motion.div>
  );
}

