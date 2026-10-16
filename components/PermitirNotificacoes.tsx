"use client";

// Cartão "Permitir notificações": um toque para liberar, direto no app.
// Se o Android ainda pode perguntar, abre a janela dele; se já foi negado,
// abre a tela de notificações da Nórica nas Configurações. Ao voltar, confere sozinho.

import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, CheckCircle2 } from 'lucide-react';
import { askNotificationPermission, notificationStatus } from '@/lib/reminder';

type Status = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'error' | null;

export default function PermitirNotificacoes({ onGranted, compact = false }: { onGranted?: () => void; compact?: boolean }) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [wentToSettings, setWentToSettings] = useState(false);

  const check = async () => {
    const s = await notificationStatus();
    setStatus(s);
    if (s === 'granted') onGranted?.();
    return s;
  };

  useEffect(() => {
    check();
    // Voltou das Configurações: confere de novo, sem precisar tocar em nada.
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (status === null || status === 'unsupported') return null;
  if (status === 'granted') {
    return compact ? null : (
      <p className="flex items-center gap-2 text-[11px] font-bold text-emerald-300 mb-3" data-testid="notif-ok"><CheckCircle2 size={14} /> Notificações permitidas neste celular.</p>
    );
  }

  const allow = async () => {
    setBusy(true);
    const r = await askNotificationPermission();
    setBusy(false);
    if (r === 'granted') { setStatus('granted'); onGranted?.(); }
    else if (r === 'settings') setWentToSettings(true);
    else check();
  };

  return (
    <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-300/25 space-y-3 mb-4" data-testid="permitir-notificacoes">
      <div className="flex items-start gap-3">
        <BellRing size={18} className="text-amber-300 shrink-0 mt-0.5" />
        <p className="text-[12px] text-white/80 font-semibold leading-relaxed">
          {wentToSettings
            ? 'Na tela que abriu, ligue "Permitir notificações" e volte para a Nórica. A gente confere sozinho.'
            : 'Para a Nórica te lembrar, o celular precisa permitir as notificações dela.'}
        </p>
      </div>
      <button onClick={allow} disabled={busy} className="w-full py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
        {busy && <Loader2 size={14} className="animate-spin" />} {wentToSettings ? 'Abrir de novo' : 'Permitir notificações'}
      </button>
    </div>
  );
}
