"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Anchor, ArrowLeft, Sparkles, User, CheckCircle2 } from 'lucide-react';
import AnimatedBackground from '@/components/AnimatedBackground';
import MovingGlow from '@/components/MovingGlow';
import ParticleCoalesce from '@/components/ParticleCoalesce';
import { authMessage, emailInputProps, passwordInputProps } from '@/lib/auth-errors';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    let formatted = value;
    if (value.length > 2) formatted = value.slice(0, 2) + '/' + value.slice(2);
    if (value.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    setBirthDate(formatted);
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!email.trim() || !password) {
        setError("Preencha e-mail e senha.");
        return;
      }
      if (/^\s|\s$/.test(password)) {
        setError("A senha não pode começar nem terminar com espaço.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }
      if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
    }
    if (step === 2) {
      if (!name || !displayName || !birthDate) {
        setError("Preencha todos os campos do perfil.");
        return;
      }
      if (birthDate.length !== 10) {
        setError("Informe a data completa (DD/MM/AAAA).");
        return;
      }
      const [d, m, y] = birthDate.split('/').map(Number);
      const born = new Date(y, m - 1, d);
      if (isNaN(born.getTime()) || born.getDate() !== d || y < 1900) {
        setError("Data de nascimento inválida.");
        return;
      }
      const now = new Date();
      let age = now.getFullYear() - y;
      if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age--;
      if (age < 18) {
        setError("O Nórica é destinado a maiores de 18 anos. Se precisar de apoio agora, ligue 188 (CVV).");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNextStep();
      return;
    }

    setLoading(true);
    setError(null);

    let finalBirthDate = birthDate;
    if (birthDate.length === 10) {
      const [d, m, y] = birthDate.split('/');
      finalBirthDate = `${y}-${m}-${d}`;
    }

    const finalDisplayName = displayName.trim() || name.split(' ')[0];

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { 
            display_name: finalDisplayName, 
            full_name: name,
            birth_date: finalBirthDate,
            referral: referral 
          },
          emailRedirectTo: 'com.zcx.norica://login-callback'
        }
      });

      if (signUpError) throw signUpError;

      // E-mail que já tem conta: o Supabase devolve um usuário "vazio" (sem identidades) e não manda e-mail.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setStep(1);
        setError('Este e-mail já tem conta na Nórica. Volte e entre com ele — ou toque em "Esqueci a senha".');
        return;
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: finalDisplayName,
          birth_date: finalBirthDate,
          referral: referral,
          updated_at: new Date().toISOString()
        });

        // 2. A Mágica do Redirecionamento Direto
        // Se a confirmação de e-mail estiver desligada no Supabase, o data.session existirá.
        if (data.session) {
          router.push('/'); // Redireciona direto para o Dashboard/Home
        } else {
          // Fallback: se o Supabase ainda exigir confirmação (como decidido agora), mostra o Step 4
          setStep(4);
        }
      }
    } catch (err: any) {
      // Senha fraca ou e-mail inválido: volta para o passo 1, onde a pessoa pode corrigir.
      const msg = authMessage(err);
      if (/senha|e-mail/i.test(msg)) setStep(1);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#080D19] flex flex-col items-center justify-start p-6 relative overflow-hidden font-sans selection:bg-[#00D88B]/30 touch-none overscroll-none">
      <AnimatedBackground subtle={false} />
      <MovingGlow />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[420px] flex flex-col items-center z-10 pt-4 pointer-events-auto"
      >
        <div className="w-full flex justify-between items-center mb-6 px-2 shrink-0">
          <button 
            onClick={() => {
              if (step > 1 && step < 4) {
                setStep(step - 1);
              } else {
                router.push('/');
              }
            }}
            className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-[#00D88B] transition-colors"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-8 h-1 rounded-full transition-all ${s <= step ? 'bg-[#00D88B]' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        <ParticleCoalesce className="w-full bg-[#101726]/80 backdrop-blur-3xl rounded-[2.5rem] p-6 md:p-8 border border-white/5 shadow-2xl flex-none overflow-hidden">
          <form onSubmit={handleSignup} className="space-y-4">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-[24px] font-black text-white italic uppercase tracking-tighter leading-none">Acesso Seguro</h2>
                    <p className="text-[#00D88B]/60 font-black text-[9px] uppercase tracking-[0.3em]">Passo 1: Credenciais</p>
                  </div>
                  <div className="space-y-3">
                    <div className="group relative">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00D88B] transition-colors" size={16} />
                      <input
                        required
                        type="email"
                        {...emailInputProps}
                        placeholder="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-[56px] bg-white/5 border border-white/10 rounded-full px-14 text-sm font-bold text-white outline-none focus:border-[#00D88B]/40 focus:bg-white/10 transition-all placeholder:text-white/10"
                      />
                    </div>
                    <div className="group relative">
                      <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00D88B] transition-colors" size={16} />
                      <input
                        required
                        type="password"
                        {...passwordInputProps}
                        autoComplete="new-password"
                        placeholder="Senha (mínimo 6 caracteres)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-[56px] bg-white/5 border border-white/10 rounded-full px-14 text-sm font-bold text-white outline-none focus:border-[#00D88B]/40 focus:bg-white/10 transition-all placeholder:text-white/10"
                      />
                    </div>
                    <div className="group relative">
                      <CheckCircle2 className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00D88B] transition-colors" size={16} />
                      <input
                        required
                        type="password"
                        {...passwordInputProps}
                        autoComplete="new-password"
                        placeholder="Confirmar Senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-[56px] bg-white/5 border border-white/10 rounded-full px-14 text-sm font-bold text-white outline-none focus:border-[#00D88B]/40 focus:bg-white/10 transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-[24px] font-black text-white italic uppercase tracking-tighter leading-none">Sobre Você</h2>
                    <p className="text-[#00D88B]/60 font-black text-[9px] uppercase tracking-[0.3em]">Passo 2: Sobre você</p>
                  </div>
                  <div className="space-y-3">
                    <div className="group relative">
                      <User className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00D88B] transition-colors" size={16} />
                      <input
                        required
                        type="text"
                        placeholder="Nome Completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-[56px] bg-white/5 border border-white/10 rounded-full px-14 text-sm font-bold text-white outline-none focus:border-[#00D88B]/40 focus:bg-white/10 transition-all placeholder:text-white/10"
                      />
                    </div>
                    <div className="group relative">
                      <Anchor className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00D88B] transition-colors" size={16} />
                      <input
                        required
                        type="text"
                        placeholder="Como quer ser chamado?"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full h-[56px] bg-white/5 border border-white/10 rounded-full px-14 text-xs font-bold text-white outline-none focus:border-[#00D88B]/40 focus:bg-white/10 transition-all placeholder:text-white/10"
                      />
                    </div>
                    <div className="group relative">
                      <Sparkles className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00D88B] transition-colors" size={16} />
                      <input
                        required
                        type="text"
                        placeholder="Nascimento (DD/MM/AAAA)"
                        value={birthDate}
                        onChange={handleBirthDateChange}
                        className="w-full h-[56px] bg-white/5 border border-white/10 rounded-full px-14 text-sm font-bold text-white outline-none focus:border-[#00D88B]/40 focus:bg-white/10 transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-[24px] font-black text-white italic uppercase tracking-tighter leading-none">Último Passo</h2>
                    <p className="text-[#00D88B]/60 font-black text-[9px] uppercase tracking-[0.3em]">Passo 3: Conexão</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {['Instagram', 'TikTok', 'Recomendação', 'Anúncio', 'Outros'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setReferral(opt)}
                        className={`h-[52px] rounded-full text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-3 ${referral === opt ? 'bg-[#00D88B] text-[#080D19] border-[#00D88B] shadow-lg' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                      >
                        {referral === opt && <CheckCircle2 size={16} />}
                        {opt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center space-y-6 py-4"
                >
                  <div className="w-20 h-20 bg-[#00D88B]/20 text-[#00D88B] rounded-full flex items-center justify-center mx-auto shadow-2xl border border-[#00D88B]/20">
                    <CheckCircle2 size={40} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Quase lá!</h3>
                    <div className="bg-white/5 py-3 px-4 rounded-2xl border border-white/5">
                      <p className="text-white/30 font-bold text-[9px] uppercase tracking-widest leading-loose mb-1">
                        Confirme no e-mail:
                      </p>
                      <p className="text-[#00D88B] font-black text-sm truncate">{email}</p>
                    </div>
                    <p className="text-white/40 text-[10px] font-bold leading-relaxed px-4">
                      Abra o e-mail da Nórica <b className="text-white/70">neste celular</b> e toque no link de ativação. Não chegou? Veja a caixa de spam ou promoções.
                    </p>
                    <p className="text-white/40 text-[10px] font-bold leading-relaxed px-4">
                      Depois de confirmar, entre com o mesmo e-mail e a senha que você criou.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[9px] font-black uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            {step < 4 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading || (step === 3 && !referral)}
                className="relative w-full h-[60px] bg-gradient-to-r from-[#00D88B] to-teal-400 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] text-[#040810] transition-all shadow-[0_0_30px_rgba(0,216,139,0.3)] hover:shadow-[0_0_40px_rgba(0,216,139,0.5)] active:scale-[0.98] uppercase tracking-[0.2em] overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Dynamic Glare */}
                <motion.div 
                  className="absolute inset-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                  animate={{ x: ['-200%', '400%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
                />
                <span className="relative z-10">
                  {loading ? 'Sincronizando...' : (step < 3 ? 'Continuar' : 'Finalizar Cadastro')}
                </span>
                {!loading && <ArrowRight size={18} className="relative z-10" />}
              </motion.button>
            )}

            {step === 4 && (
              <motion.button
                type="button"
                onClick={() => {
                  router.push('/');
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-white text-[#080D19] rounded-full h-[60px] font-black uppercase tracking-widest text-[10px] shadow-xl transition-all"
              >
                Voltar para Login
              </motion.button>
            )}
          </form>
        </ParticleCoalesce>
      </motion.div>
    </div>
  );
}
