"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Send, CheckCircle2, LifeBuoy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import AnimatedBackground from '@/components/AnimatedBackground'; // Usando o background padrão se o outro não existir
import MovingGlow from '@/components/MovingGlow';
import ParticleCoalesce from '@/components/ParticleCoalesce';
import { authMessage, emailInputProps } from '@/lib/auth-errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // REMOVER O MENU (DOCK) NESTA PÁGINA
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggleDock', { detail: false }));
    return () => {
      window.dispatchEvent(new CustomEvent('toggleDock', { detail: true }));
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `com.zcx.norica://login-callback?type=recovery`,
      });

      if (error) {
        setError(authMessage(error));
      } else {
        setStep('code');
      }
    } catch (err: any) {
      setError(authMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative flex items-center justify-center p-6 overflow-hidden bg-[#080D19]">
      <div className="absolute inset-0 bg-[#080D19]" />
      <MovingGlow />
      
      {/* Decoração de Fundo */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto relative z-10"
      >
        <div className="flex justify-center mb-8">
          <button 
            onClick={() => router.back()} // Volta para onde o usuário estava
            className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-500 hover:bg-white/10 transition-all shadow-xl"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>

        <ParticleCoalesce className="bg-[#101726]/80 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden">
          {/* Barra de Progresso Sutil */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
             <motion.div 
               initial={{ width: "0%" }}
               animate={{ width: step === 'email' ? '50%' : '100%' }}
               className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
             />
          </div>
          
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="inline-flex p-5 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 text-emerald-400 rounded-3xl mb-2 shadow-inner border border-emerald-500/10">
                    <LifeBuoy size={36} />
                  </div>
                  <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Segurança</h1>
                  <p className="text-emerald-500/60 font-black text-[9px] uppercase tracking-[0.4em]">Redefinir Acesso</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6">Seu e-mail</label>
                    <div className="group relative">
                      <Mail className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors" size={20} />
                      <input
                        required
                        type="email"
                        {...emailInputProps}
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-full pl-16 pr-6 py-6 outline-none focus:border-emerald-500/40 focus:bg-white/10 transition-all text-white font-bold text-sm shadow-inner"
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center leading-relaxed"
                    >
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: '#10b981' }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isLoading}
                    className="w-full bg-emerald-600 text-slate-950 font-black py-7 rounded-full flex items-center justify-center gap-4 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)] disabled:opacity-50"
                  >
                    <span className="text-xs uppercase tracking-[0.4em]">
                      {isLoading ? "Validando..." : "Solicitar Link"}
                    </span>
                    {!isLoading && <Send size={20} />}
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="success-step"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-10 py-4"
              >
                <div className="relative">
                  <div className="w-28 h-28 bg-emerald-500/10 text-emerald-400 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl border border-emerald-500/20 relative z-10">
                    <CheckCircle2 size={56} />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full" />
                </div>

                <div className="space-y-4">
                  <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">E-mail enviado</h3>
                  <div className="bg-white/5 py-3 px-4 rounded-2xl border border-white/5 overflow-hidden">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-loose">
                      Verifique o e-mail:
                    </p>
                    <p className="text-emerald-400 font-black text-sm truncate">{email}</p>
                  </div>
                  <p className="text-slate-500 text-[10px] font-bold leading-relaxed px-6">
                    Abra o e-mail <b className="text-slate-300">neste celular</b> e toque no link: a Nórica abre e pede a senha nova. Não chegou? Veja o spam e espere 1 minuto antes de pedir outro.
                  </p>
                </div>

                <div className="pt-4 space-y-4">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      router.push('/');
                    }}
                    className="w-full bg-white text-slate-950 rounded-full py-6 font-black uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-emerald-50 transition-all"
                  >
                    Voltar para Login
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ParticleCoalesce>
      </motion.div>
    </div>
  );
}
