"use client";

// Criar uma senha nova depois de tocar no link "Esqueci a senha" do e-mail.
// O link já entra na conta (código de uso único); aqui a pessoa escolhe a senha nova.

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, CheckCircle2, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import MovingGlow from '@/components/MovingGlow';
import { authMessage, passwordInputProps } from '@/lib/auth-errors';

export default function NovaSenhaPage() {
  const router = useRouter();
  const [ready, setReady] = useState<'checking' | 'ok' | 'no-session'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Esconde o menu de baixo (depois que ele já está ouvindo).
    const hide = setTimeout(() => window.dispatchEvent(new CustomEvent('toggleDock', { detail: false })), 0);
    let alive = true;
    // A sessão do link pode levar um instante para chegar (o app troca o código assim que abre).
    const check = async (tries: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      if (session) setReady('ok');
      else if (tries > 0) setTimeout(() => check(tries - 1), 700);
      else setReady('no-session');
    };
    check(6);
    return () => { alive = false; clearTimeout(hide); window.dispatchEvent(new CustomEvent('toggleDock', { detail: true })); };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (/^\s|\s$/.test(password)) { setError('A senha não pode começar nem terminar com espaço.'); return; }
    if (password !== confirm) { setError('As duas senhas não são iguais.'); return; }
    setBusy(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (upErr) { setError(authMessage(upErr)); return; }
    setDone(true);
    setTimeout(() => router.replace('/'), 1800);
  };

  const field = 'w-full h-[56px] bg-white/5 border border-white/10 rounded-full pl-14 pr-14 text-sm font-bold text-white outline-none focus:border-emerald-500/40 focus:bg-white/10 transition-all placeholder:text-white/25';

  return (
    <main className="min-h-[100dvh] relative flex items-center justify-center p-6 overflow-hidden bg-[#080D19]" data-testid="nova-senha">
      <MovingGlow />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto relative z-10">
        <div className="bg-[#101726]/80 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] space-y-7">
          <div className="text-center space-y-3">
            <div className="inline-flex p-5 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 text-emerald-400 rounded-3xl border border-emerald-500/10">
              {done ? <CheckCircle2 size={34} /> : <KeyRound size={34} />}
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">{done ? 'Senha salva' : 'Nova senha'}</h1>
            <p className="text-emerald-500/60 font-black text-[9px] uppercase tracking-[0.35em]">{done ? 'Entrando na Nórica…' : 'Escolha uma senha nova'}</p>
          </div>

          {ready === 'checking' && (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-emerald-400" /></div>
          )}

          {ready === 'no-session' && (
            <div className="space-y-5 text-center">
              <p className="text-sm text-white/70 font-semibold leading-relaxed">
                Esse link expirou ou foi aberto em outro aparelho. Peça um novo e toque nele <b className="text-white">neste celular</b>.
              </p>
              <button onClick={() => router.replace('/auth/forgot-password/')} className="w-full bg-emerald-600 text-slate-950 font-black py-5 rounded-full text-[11px] uppercase tracking-[0.3em]">
                Pedir novo link
              </button>
              <button onClick={() => router.replace('/')} className="flex items-center justify-center gap-2 mx-auto text-[10px] font-black text-white/40 uppercase tracking-widest">
                <ArrowLeft size={13} /> Voltar para o login
              </button>
            </div>
          )}

          {ready === 'ok' && !done && (
            <form onSubmit={save} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                <input
                  type={show ? 'text' : 'password'}
                  {...passwordInputProps}
                  autoComplete="new-password"
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  data-testid="nova-senha-1"
                />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <CheckCircle2 className="absolute left-6 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                <input
                  type={show ? 'text' : 'password'}
                  {...passwordInputProps}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={field}
                  data-testid="nova-senha-2"
                />
              </div>
              {error && <p className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-[11px] font-bold text-center leading-relaxed">{error}</p>}
              <button type="submit" disabled={busy} className="w-full bg-emerald-600 text-slate-950 font-black py-5 rounded-full text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 disabled:opacity-50" data-testid="salvar-senha">
                {busy && <Loader2 size={15} className="animate-spin" />} Salvar nova senha
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </main>
  );
}
