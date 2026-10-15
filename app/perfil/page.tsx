"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase-client';
import { 
  User, Save, CheckCircle2, ArrowLeft, ShieldCheck, 
  Anchor, LifeBuoy, Mail, Calendar, 
  LogOut, Settings, Fingerprint, AlertCircle, Loader2,
  ChevronRight, BadgeCheck, Shield, Key, Sparkles,
  ShipWheel, Compass, Waves, Camera
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

// Componente para efeito de digitação lenta
const TypingName = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    let i = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 200); // Digitação bem lenta conforme pedido
    return () => clearInterval(interval);
  }, [text]);

  return (
    <motion.span 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="inline-block"
    >
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="inline-block ml-1 w-1 h-8 bg-emerald-500"
      />
    </motion.span>
  );
};

export default function PerfilPage() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [age, setAge] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [isExiting, setIsExiting] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const calculateAge = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 10) return;
    const [d, m, y] = dateStr.split('/').map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return;
    const birth = new Date(y, m - 1, d);
    const today = new Date();
    let ageVal = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      ageVal--;
    }
    setAge(ageVal >= 0 ? ageVal : 0);
  };

  useEffect(() => {
    setIsMounted(true);
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const sessionUser = session.user;
      setUser(sessionUser);
      
      const metaName = sessionUser.user_metadata?.display_name;
      const metaBirth = sessionUser.user_metadata?.birth_date;
      const metaAvatar = sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture;
      
      if (metaAvatar) setAvatarUrl(metaAvatar);
      if (metaName) setName(metaName);
      if (metaBirth) {
        const [y, m, d] = metaBirth.split('-');
        const formatted = `${d}/${m}/${y}`;
        setBirthDate(formatted);
        calculateAge(formatted);
        setIsLocked(true);
      }

      const { data: profile } = await supabase.from('profiles')
        .select('display_name, birth_date')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (profile) {
        if (profile.display_name) setName(profile.display_name);
        if (profile.birth_date) {
          const [y, m, d] = profile.birth_date.split('-');
          const formatted = `${d}/${m}/${y}`;
          setBirthDate(formatted);
          calculateAge(formatted);
          setIsLocked(true);
        }
      }
      setIsDataLoaded(true);
    };
    loadProfile();
  }, [supabase]);

  useEffect(() => {
    if (isExiting) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isExiting]);

  const handleBirthDateChange = (val: string) => {
    if (isLocked) return;
    const cleaned = val.replace(/\D/g, '').slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    setBirthDate(formatted);
    if (formatted.length === 10) calculateAge(formatted);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading || isLocked) return;

    setError(null);
    if (!name.trim()) { setError("Digite seu nome."); return; }
    if (birthDate.length !== 10) { setError("Data de nascimento incompleta."); return; }

    setLoading(true);
    try {
      const [d, m, y] = birthDate.split('/');
      const isoDate = `${y}-${m}-${d}`;
      
      const { error: authError } = await supabase.auth.updateUser({ 
        data: { display_name: name.trim(), birth_date: isoDate } 
      });
      if (authError) throw authError;

      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: name.trim(),
        birth_date: isoDate,
        updated_at: new Date().toISOString(),
        name_changed: true
      });

      setSaved(true);
      setIsLocked(true);
      await supabase.auth.refreshSession();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError("Erro ao salvar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsExiting(true);
    // Aguarda animação de "afundar" antes de deslogar
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace('/');
    }, 1500);
  };

  if (!isMounted) return null;

  return (
    <main className="min-h-screen relative transition-all overflow-x-hidden pb-40 selection:bg-emerald-500/10 bg-transparent">
      <AnimatedBackground subtle />
      
      <AnimatePresence>
        {isExiting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#050810] flex items-center justify-center overflow-hidden touch-none overscroll-none"
            onWheel={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#050810] to-[#050810]" />
            
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center mb-8">
                <motion.div
                  animate={{ scale: [1, 3], opacity: [0.5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-24 h-24 rounded-full border border-emerald-500/20"
                />
                <motion.div
                  animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  className="absolute w-24 h-24 rounded-full border border-emerald-400/40"
                />
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)] relative z-10"
                >
                  <Anchor size={40} className="text-emerald-400" />
                </motion.div>
              </div>
              
              <div className="space-y-2 text-center relative z-10">
                <motion.p 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-emerald-400 font-black uppercase tracking-[0.4em] text-[11px]"
                >
                  Desatracando
                </motion.p>
                <p className="text-white/40 font-bold tracking-widest text-[9px] uppercase">Saindo do porto seguro</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="fixed top-0 inset-x-0 h-20 bg-white/5 backdrop-blur-2xl border-b border-white/10 z-50 flex items-center justify-center px-6 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <h2 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] italic">Comando Central</h2>
      </header>

      <motion.div
        animate={isExiting ? { scale: 0.8, opacity: 0, y: 100 } : { scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="max-w-md mx-auto px-6 pt-32 relative z-10 space-y-8"
      >
        
        {/* Avatar Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          whileTap={{ scale: 0.98 }}
          style={{ willChange: 'transform, opacity' }}
          className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] text-center space-y-6 relative overflow-hidden cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.03] rounded-bl-full -mr-8 -mt-8" />
          
          <div className="relative inline-block">
            {/* Timão Oscilante / Avatar */}
            <motion.div 
              animate={{ rotate: avatarUrl ? 0 : [0, 8, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="w-32 h-32 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 rounded-[3.2rem] flex items-center justify-center border-[6px] border-white/10 shadow-2xl relative z-10 overflow-hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Marujo')}&background=064e3b&color=34d399&size=256`} alt="Avatar" className="w-full h-full object-cover pointer-events-none" />
              )}
            </motion.div>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic min-h-[44px] flex items-center justify-center">
              {isDataLoaded ? <TypingName text={name || "Marujo"} /> : "..."}
            </h1>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Navegador Ativo</p>
          </div>
        </motion.div>

        {/* Data Form */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ willChange: 'transform, opacity' }}
          className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] space-y-8 relative overflow-hidden"
        >
           <form onSubmit={handleUpdate} className="space-y-6 relative z-10">
              {error && (
                <div className="p-4 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-2xl border border-rose-500/20 flex items-center gap-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Identidade de Bordo</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-300 transition-colors">
                    <Fingerprint size={20} />
                  </div>
                  <input
                    disabled={isLocked || !isDataLoaded}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome..."
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-16 py-5 outline-none focus:border-emerald-400 transition-all text-base font-bold text-white placeholder-white/20 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Data de nascimento</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-300 transition-colors">
                    <Calendar size={20} />
                  </div>
                  <input
                    disabled={isLocked || !isDataLoaded}
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-16 py-5 outline-none focus:border-emerald-400 transition-all text-base font-bold text-white placeholder-white/20 disabled:opacity-60"
                  />
                </div>
                
                {/* CARD DE IDADE BONITO */}
                <AnimatePresence>
                  {age !== null && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative mt-4 p-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] overflow-hidden border-2 border-white/20"
                    >
                      <div className="absolute -right-4 -top-4 text-white/10 rotate-12">
                         <ShipWheel size={120} />
                      </div>
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Idade no Mar</p>
                          <h3 className="text-4xl font-black italic tracking-tighter leading-none">{age} <span className="text-xl">Anos</span></h3>
                        </div>
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                           <Waves size={28} className="text-white/80" />
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                           <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: '100%' }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                            className="h-full bg-white/60"
                           />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Jornada em Curso</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!isLocked ? (
                <div className="relative group">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl group-hover:bg-emerald-400/30 transition-colors pointer-events-none rounded-2xl" />
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    disabled={loading || !isDataLoaded}
                    type="submit"
                    className="relative w-full py-5 bg-[#050810] rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 border border-emerald-500/50 hover:border-emerald-400 overflow-hidden text-emerald-400 hover:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                  >
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {/* Linha de Scanner */}
                    <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent skew-x-[-45deg]" style={{ animation: 'shimmer 2.5s infinite linear' }} />
                    <style dangerouslySetInnerHTML={{ __html: `@keyframes shimmer { 100% { left: 200%; } }` }} />
                    
                    <div className="relative flex items-center justify-center gap-3 z-10">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Registrar Identidade"}
                      {!loading && <ChevronRight size={18} strokeWidth={2.5} />}
                    </div>
                  </motion.button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-6 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-white/10 text-emerald-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-sm">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Identidade Ancorada</p>
                    <p className="text-[9px] font-bold text-white/40 uppercase mt-1 leading-none">Registro seguro no porto.</p>
                  </div>
                </motion.div>
              )}
           </form>
        </motion.div>

        {/* Logout */}
        <motion.button 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileTap={{ scale: 0.96 }}
          style={{ willChange: 'transform, opacity' }}
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-7 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <LogOut size={24} />
             </div>
             <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Sair</h3>
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mt-1">Encerrar Sessão</p>
             </div>
          </div>
          <ChevronRight size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        <p className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.5em] italic pt-10">
          Nórica • Foco e Produtividade
        </p>
      </motion.div>
    </main>
  );
}



