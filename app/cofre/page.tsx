"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Lock, ShieldCheck, Key, ArrowLeft, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CofrePage() {
  const [hasStarted, setHasStarted] = useState(false);
  const [text, setText] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const router = useRouter();

  const handleBlur = () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
    }, 100);
  };

  const handleSave = () => {
    if (!text) return;
    setIsSaving(true);
    localStorage.setItem('norica_vault_latest', text);
    
    setTimeout(() => {
      setIsSaving(false);
      setShowSavedToast(true);
      setText('');
      setTimeout(() => setShowSavedToast(false), 4000);
    }, 1500);
  };

  const handleBurn = () => {
    if (!text || isBurning) return;
    setIsBurning(true);
    setTimeout(() => {
      setText('');
      setIsBurning(false);
    }, 3000); // Aumentado para garantir fim da animação
  };

  return (
    <main className={`fixed inset-0 flex flex-col overflow-hidden bg-black p-4 md:p-8 z-10 overscroll-none touch-pan-y ${isBurning ? 'animate-shake' : ''}`}>
      <style jsx global>{`
        @keyframes shake-screen {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
          animation: shake-screen 0.3s infinite;
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
        {[...Array(15)].map((_: any, i: number) => (
          <motion.div
            key={i}
            animate={{ 
              y: [-10, 10, -10],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 3 + i, repeat: Infinity }}
            className="absolute w-px h-px bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"
            style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!hasStarted ? (
          <motion.div 
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center relative z-10"
          >
            {/* Mobile Menu removed as requested */}

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl flex items-center justify-center text-emerald-400 mb-8 shadow-2xl"
            >
              <Lock size={32} />
            </motion.div>
            <h2 className="text-4xl font-black text-white tracking-tight mb-4 uppercase italic">O COFRE</h2>
            <p className="text-emerald-500/60 font-mono text-[10px] tracking-[0.3em] uppercase max-w-xs leading-relaxed mb-10">
              Espaço sagrado para o que não pode ser dito, apenas guardado.
            </p>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setHasStarted(true)}
                className="w-full py-5 bg-white text-black font-black rounded-3xl text-[10px] uppercase tracking-[0.2em] shadow-xl"
              >
                ABRIR SANTUÁRIO
              </motion.button>
              <button 
                onClick={() => {
                  router.push('/');
                }}
                className="text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </motion.div>
        ) : (
          <motion.div 
            key="vault-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col p-6 md:p-12 relative z-10 overflow-hidden"
          >
            {/* Header Flex-none */}
            <div className="flex-none flex items-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setHasStarted(false)}
                  className="p-3 border border-white/10 text-white/40 hover:text-white rounded-2xl bg-white/5 transition-all"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                  <span className="text-[10px] font-mono tracking-[0.4em] text-emerald-500/60 uppercase font-black">
                    Santuário Ativo
                  </span>
                </div>
              </div>
            </div>

            {/* ÁREA DE TEXTO Flex-1 */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {!isBurning ? (
                  <motion.textarea
                    key="vault-input"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0.1,
                      x: [0, -10, 10, -20, 20, -30, 30, -10, 10, 0],
                      y: [0, -100, -500],
                      filter: "blur(20px)",
                      transition: { duration: 2 }
                    }}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    spellCheck={false}
                    placeholder="ESCREVA O QUE PESA EM SUA MENTE..."
                    className={`
                      h-full w-full bg-transparent font-mono text-xl md:text-3xl lg:text-4xl 
                      outline-none resize-none leading-relaxed tracking-tight
                      placeholder:text-emerald-500/20 scrollbar-hide text-emerald-500/80
                    `}
                  />
                ) : (
                  <div key="burning-placeholder" className="flex-1" />
                )}
              </AnimatePresence>

              {/* Animação de Queimar Melhorada - Cinzas e Fagulhas */}
              {isBurning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]">
                  {[...Array(40)].map((_: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 100, scale: 0 }}
                      animate={{ 
                        opacity: [0, 1, 1, 0], 
                        y: [200, -800], 
                        x: [(i - 20) * 15, (i - 20) * 40 + (Math.random() - 0.5) * 400],
                        scale: [Math.random() * 2, Math.random() * 6, 0],
                        rotate: Math.random() * 1080
                      }}
                      transition={{ 
                        duration: 1.5 + Math.random() * 2, 
                        delay: Math.random() * 0.8,
                        ease: "easeOut"
                      }}
                      className={`absolute ${i % 3 === 0 ? 'text-orange-500' : i % 3 === 1 ? 'text-red-500' : 'text-yellow-400'}`}
                    >
                      <Flame size={20 + Math.random() * 60} fill="currentColor" />
                    </motion.div>
                  ))}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.8, 0] }}
                    transition={{ duration: 3 }}
                    className="absolute inset-0 bg-gradient-to-t from-orange-600 via-red-500/20 to-transparent blur-[150px]"
                  />
                </div>
              )}

              {/* Animação de Salvar Melhorada */}
              {isSaving && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    initial={{ scale: 8, opacity: 0, rotate: -360 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ duration: 1.2, ease: "backOut" }}
                    className="text-emerald-500"
                  >
                    <ShieldCheck size={180} strokeWidth={0.5} />
                  </motion.div>
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [1, 4], opacity: [0.8, 0] }}
                    transition={{ duration: 1.2 }}
                    className="absolute w-64 h-64 border-[8px] border-emerald-500 rounded-full"
                  />
                </div>
              )}
            </div>

            {/* BOTÕES Flex-none */}
            <div className="flex-none flex flex-col md:flex-row gap-4 pt-4 pb-8 bg-black z-50">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={isSaving || isBurning || !text}
                className="flex-1 py-4 bg-emerald-500 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg disabled:opacity-20 flex items-center justify-center gap-2"
              >
                <Lock size={14} />
                {isSaving ? 'SELANDO...' : 'Selar Segredo'}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBurn}
                disabled={isBurning || isSaving || !text}
                className="flex-1 py-4 border border-orange-500/30 text-orange-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-500/10 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
              >
                <Flame size={14} />
                {isBurning ? 'QUEIMANDO...' : 'Queimar Tudo'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSavedToast && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-8"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mb-6 shadow-2xl"
            >
              <ShieldCheck size={40} />
            </motion.div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Segredo Guardado</h2>
            <p className="text-emerald-500/60 font-mono text-[10px] tracking-[0.3em] uppercase mb-10">A sete chaves.</p>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSavedToast(false)}
              className="px-12 py-5 bg-white text-black font-black rounded-3xl text-xs uppercase tracking-widest shadow-2xl"
            >
              Voltar ao Silêncio
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
