"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, ArrowLeft, User } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import LoginBackground from '@/components/LoginBackground';
import MovingGlow from '@/components/MovingGlow';
import PixelShadow from '@/components/PixelShadow';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/');
    };
    checkSession();
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId || clientId.startsWith("YOUR_GOOGLE_WEB_CLIENT_ID")) {
          throw new Error("Client ID do Google não configurado no arquivo de ambiente.");
        }
        await GoogleSignIn.initialize({
          clientId: clientId,
          serverClientId: clientId, // Faltava isso para o Supabase!
          scopes: ['email', 'profile'],
          offlineAccess: true, // Faltava isso para gerar o token corretamente
        });
        const result = await GoogleSignIn.signIn();
        if (!result.idToken) {
          throw new Error("Não foi possível obter o token do Google Sign-In.");
        }
        const { data, error: signInError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });
        if (signInError) throw signInError;
        router.replace('/');
      } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.zcx.norica://login-callback',
            queryParams: { prompt: 'select_account' },
            skipBrowserRedirect: true
          },
        });
        if (error) throw error;
        if (data?.url) {
          await Browser.open({ url: data.url, windowName: '_self' });
        }
      }
    } catch (err: any) {
      setError(err.message || "Falha na conexão Google.");
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push('/');
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setError("E-mail ou senha inválidos.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Confirme seu e-mail para entrar.");
      } else if (msg.includes("Rate limit exceeded")) {
        setError("Muitas tentativas. Tente mais tarde.");
      } else {
        setError("Erro ao entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative flex items-center justify-center p-4 md:p-8 overflow-hidden selection:bg-emerald-500/30">
      <LoginBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] mx-auto relative z-10"
      >
        <div className="text-center mb-8 relative">
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="inline-flex mb-6"
          >
            <motion.div
              animate={{ 
                boxShadow: [
                  "0px 10px 30px rgba(16,185,129,0.2)", 
                  "0px 15px 40px rgba(16,185,129,0.4)", 
                  "0px 10px 30px rgba(16,185,129,0.2)"
                ]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="p-5 bg-emerald-500 text-[#080d19] rounded-[1.25rem]"
            >
              <AppLogo size={40} />
            </motion.div>
          </motion.div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-md">
            Porto Seguro
          </h1>
          <p className="text-emerald-500/80 font-bold text-[10px] uppercase tracking-[0.3em] mt-3">Nórica • Mental Navigation</p>
        </div>

        <div className="relative w-full rounded-3xl p-[2px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] z-10">
          
          {/* Fundo da borda (bem suave) */}
          <div className="absolute inset-0 bg-white/5" />
          
          {/* Luz Animada 1 (Vai para a direita) */}
          <div
            className="absolute top-1/2 left-1/2 w-[250%] aspect-square pointer-events-none animate-border-cw"
            style={{
              background: 'conic-gradient(from 180deg at 50% 50%, transparent 160deg, rgba(255,255,255,1) 180deg, transparent 200deg)'
            }}
          />

          {/* Luz Animada 2 (Vai para a esquerda) */}
          <div
            className="absolute top-1/2 left-1/2 w-[250%] aspect-square pointer-events-none animate-border-ccw"
            style={{
              background: 'conic-gradient(from 180deg at 50% 50%, transparent 160deg, rgba(255,255,255,1) 180deg, transparent 200deg)'
            }}
          />

          {/* Conteúdo interno do Card */}
          <div className="relative w-full h-full bg-[#0d1424]/90 backdrop-blur-xl rounded-[22px] p-8">
            <motion.div 
              className="space-y-6 relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
            {/* Google Button */}
            <motion.div variants={itemVariants}>
              <motion.button 
              whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin} 
              disabled={loading} 
              className="w-full h-[50px] bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 font-bold text-[11px] text-white transition-all shadow-sm active:scale-[0.98]"
            >
              <GoogleIcon />
              CONTINUAR COM GOOGLE
              </motion.button>
            </motion.div>

            <motion.div variants={itemVariants} className="flex items-center gap-3 py-2">
              <div className="flex-1 h-[1px] bg-white/10" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Ou acesse com e-mail</span>
              <div className="flex-1 h-[1px] bg-white/10" />
            </motion.div>

            <form onSubmit={handleAuth} className="space-y-4">
              <motion.div variants={itemVariants} className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#00D88B] transition-colors" size={18} />
                <input 
                  type="email" 
                  placeholder="Seu E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[50px] bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 text-sm text-white outline-none focus:border-[#00D88B]/60 focus:bg-black/50 transition-all placeholder:text-white/30"
                />
              </motion.div>

              <motion.div variants={itemVariants} className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#00D88B] transition-colors" size={18} />
                <input 
                  type="password" 
                  placeholder="Sua Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[50px] bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 text-sm text-white outline-none focus:border-[#00D88B]/60 focus:bg-black/50 transition-all placeholder:text-white/30"
                />
              </motion.div>

              <motion.div variants={itemVariants} className="flex justify-between items-center px-1 py-2">
                <motion.label 
                  whileTap={{ scale: 0.92 }}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className="relative w-4 h-4 rounded-md bg-black/40 border border-white/20 flex items-center justify-center transition-all group-hover:border-[#00D88B]/60">
                    <input type="checkbox" className="peer absolute opacity-0 w-full h-full cursor-pointer" />
                    <div className="w-2 h-2 rounded-[2px] bg-[#00D88B] opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] font-bold text-white/60 group-hover:text-white/90 transition-colors">Lembrar de mim</span>
                </motion.label>
                <button 
                  type="button"
                  onClick={() => router.push('/auth/forgot-password/')}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </motion.div>

              {error && (
                <motion.div 
                  variants={itemVariants}
                  className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-[11px] font-bold text-center"
                >
                  {error}
                </motion.div>
              )}

              <motion.div variants={itemVariants}>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                type="submit" 
                disabled={loading}
                className="w-full h-[54px] bg-[#00D88B] hover:bg-emerald-400 rounded-xl flex items-center justify-center gap-2 font-black text-[12px] text-[#080d19] transition-all shadow-[0_5px_20px_rgba(0,216,139,0.25)] uppercase tracking-wider"
              >
                  {loading ? "Conectando..." : "Entrar"}
                  <ArrowRight size={16} />
                </motion.button>
              </motion.div>
            </form>

            <motion.div variants={itemVariants} className="text-center pt-6">
              <span className="text-[11px] font-medium text-white/50">Não tem uma conta? </span>
              <button 
                type="button"
                onClick={() => router.push('/auth/signup/')}
                className="text-[11px] font-bold text-white hover:text-[#00D88B] transition-colors ml-1"
              >
                Criar conta
              </button>
            </motion.div>
          </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};
