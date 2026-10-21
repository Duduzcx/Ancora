"use client";

// Planos Gratuito e Pro.
// Assinatura mensal pela Google Play (produto "norica_pro_mensal", R$ 15,00).
// Modo lançamento (NORICA_LAUNCH_ALL_PRO no servidor): todos usam o Pro de graça.
// Recursos de crise nunca ficam atrás de pagamento.

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, LifeBuoy, Loader2, Crown, Anchor, RefreshCcw, ExternalLink, Ticket } from 'lucide-react';
import { noricaApi, type PlanInfo, cachedPlan, refreshPlan } from '@/lib/norica-api';
import { getAuthState } from '@/lib/auth-store';
import {
  billingAvailable, initBilling, onBillingEvent, proPriceLabel, restorePro, subscribePro,
  MANAGE_SUBSCRIPTION_URL, PRO_PRICE_FALLBACK,
} from '@/lib/billing';

type Feature = { text: string; soon?: boolean };

const FREE_FEATURES: Feature[] = [
  { text: 'S.O.S, Respiração e botão de Ajuda (CVV 188 / SAMU 192) — sempre grátis' },
  { text: 'Porto: até 30 mensagens por dia com a Nórica' },
  { text: 'Arena: treinos à vontade e 2 retornos por dia' },
  { text: 'Logs diários com tarefas sugeridas pela IA' },
  { text: 'Farol com o mapa emocional dos últimos 7 dias' },
  { text: 'Cofre criptografado' },
  { text: 'Caderno: anotações e revisão à vontade, e 8 ajudas da IA por dia' },
  { text: 'Conquistas da jornada, Modo noite e sons para dormir' },
];

const PRO_FEATURES: Feature[] = [
  { text: 'Tudo do plano Gratuito' },
  { text: 'Porto sem limite diário: converse com a Nórica sempre que precisar' },
  { text: 'Arena com retornos ilimitados para treinar conversas difíceis' },
  { text: 'Farol com o mapa emocional dos últimos 30 dias' },
  { text: 'Resumo da semana escrito pela Nórica, todo domingo' },
  { text: 'Relatório mensal do seu mar em PDF para levar ao psicólogo' },
  { text: 'Caderno com IA sem limite: organizar, explicar, quiz e perguntar às suas anotações' },
  { text: 'Novos cenários de treino na Arena', soon: true },
  { text: 'Você apoia um app brasileiro de cuidado emocional 💚' },
];

function FeatureList({ items, dark = false }: { items: Feature[]; dark?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map(f => (
        <li key={f.text} className="flex items-start gap-3">
          <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-emerald-500 text-slate-900' : 'bg-emerald-50 text-emerald-500'}`}>
            <Check size={12} strokeWidth={3} />
          </div>
          <span className={`text-sm font-bold leading-snug ${dark ? 'text-white/80' : 'text-slate-600'}`}>
            {f.text}
            {f.soon && (
              <span className={`ml-2 align-middle text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${dark ? 'bg-white/10 text-emerald-300' : 'bg-slate-100 text-slate-400'}`}>
                em breve
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PlanosPage() {
  const router = useRouter();
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState(PRO_PRICE_FALLBACK);
  const [busy, setBusy] = useState<'buy' | 'restore' | 'code' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [joined, setJoined] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');

  const loadPlan = async () => {
    // Mostra o último plano conhecido na hora e confere com o servidor.
    const uid = getAuthState().user?.id;
    const cached = cachedPlan(uid);
    if (cached) {
      setInfo(cached);
      setJoined(cached.proInterest);
      setLoading(false);
    }
    try {
      const data = await refreshPlan(uid);
      setInfo(data);
      setJoined(data.proInterest);
    } catch (_e) {
      if (!cached) setMessage({ kind: 'error', text: 'Não foi possível carregar seu plano agora.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
    initBilling().then((ok) => { if (ok) proPriceLabel().then(setPrice); });
    const off = onBillingEvent(event => {
      setBusy(null);
      if (event.type === 'activated') {
        setMessage({ kind: 'ok', text: 'Bem-vindo(a) ao Nórica Pro! Obrigado por apoiar o projeto. 💚' });
        loadPlan();
      } else {
        setMessage({ kind: 'error', text: event.message });
      }
    });
    return () => { off(); };
  }, []);

  const isPaidPro = info?.plan === 'pro';
  const viaStore = isPaidPro && (info?.store ?? 'google_play') === 'google_play';
  const canSubscribe = !!info && !isPaidPro && !info.launch && info.billing;

  const handleSubscribe = async () => {
    setMessage(null);
    if (!canSubscribe) return;
    setBusy('buy');
    const error = await subscribePro();
    // Sucesso chega pelo evento "activated" depois da confirmação no servidor.
    if (error) { setBusy(null); setMessage({ kind: 'error', text: error }); }
    else setTimeout(() => setBusy(b => (b === 'buy' ? null : b)), 20000);
  };

  const handleRestore = async () => {
    setMessage(null);
    setBusy('restore');
    const error = await restorePro();
    setBusy(null);
    if (error) setMessage({ kind: 'error', text: error });
  };

  const handleCode = async () => {
    const c = code.trim();
    if (!c) return;
    setMessage(null);
    setBusy('code');
    try {
      const r = await noricaApi.promoRedeem(c);
      const until = r.proUntil ? new Date(r.proUntil).toLocaleDateString('pt-BR') : null;
      setMessage({ kind: 'ok', text: `Código aceito! Você é Pro${until ? ` até ${until}` : ''}. 💚` });
      setCode(''); setCodeOpen(false);
      loadPlan();
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Não foi possível usar o código agora.' });
    } finally {
      setBusy(null);
    }
  };

  const handleInterest = async () => {
    try { await noricaApi.proInterest(); setJoined(true); } catch (_e) {}
  };

  const openManage = async () => {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: MANAGE_SUBSCRIPTION_URL });
    } catch (_e) {
      window.open(MANAGE_SUBSCRIPTION_URL, '_blank');
    }
  };

  const badge = loading
    ? 'Carregando...'
    : isPaidPro ? 'Seu plano: Pro'
    : info?.launch ? 'Pro grátis no lançamento'
    : 'Seu plano: Gratuito';

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-40 bg-[#020617]">
      
      <div className="relative z-10 max-w-4xl mx-auto p-6 pt-[calc(env(safe-area-inset-top,44px)+2rem)] space-y-10">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/perfil/')} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white shadow-sm active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <Anchor size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{badge}</span>
          </div>
        </div>

        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
            Nórica <span className="text-emerald-400 italic">Pro.</span>
          </h1>
          <p className="text-white/50 font-bold max-w-md mx-auto text-sm">
            Mais espaço para cuidar de você. O essencial para atravessar dias difíceis continua sempre gratuito.
          </p>
        </div>

        {info?.launch && !isPaidPro && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] p-6 flex items-center gap-4 shadow-xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles size={22} />
            </div>
            <p className="text-sm font-bold text-white/70 leading-relaxed">
              <b className="text-white">Lançamento:</b> por enquanto, todo mundo usa os recursos do Pro de graça. Quando a assinatura abrir, você será avisado(a) aqui.
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PRO — primeiro no celular */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-emerald-950/80 to-[#0b0f19] border border-emerald-500/30 rounded-[3rem] p-8 shadow-2xl space-y-6 relative overflow-hidden md:order-2"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-bl-full pointer-events-none" />
            <div className="space-y-2 relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-900 flex items-center justify-center">
                <Crown size={22} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Pro</h2>
              <p className="text-3xl font-black text-white tracking-tighter">{price}</p>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Por pessoa • Cancele quando quiser
              </p>
            </div>
            <FeatureList items={PRO_FEATURES} dark />

            <div className="relative space-y-3">
              {isPaidPro ? (
                <>
                  <div className="w-full py-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black uppercase tracking-widest text-[10px] text-center">
                    Você é Pro{info?.proUntil ? ` até ${new Date(info.proUntil).toLocaleDateString('pt-BR')}` : ''} ✓
                  </div>
                  {viaStore && <button onClick={openManage} className="w-full py-3 rounded-2xl border border-white/15 text-white/70 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                    <ExternalLink size={12} /> Gerenciar assinatura na Google Play
                  </button>}
                </>
              ) : canSubscribe ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubscribe}
                  disabled={busy !== null}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-900 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-500/20"
                >
                  {busy === 'buy' && <Loader2 size={14} className="animate-spin" />}
                  Assinar o Pro por {price}
                </motion.button>
              ) : info?.launch ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleInterest}
                  disabled={joined}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-900 font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
                >
                  {joined ? 'Você será avisado(a) ✓' : 'Me avise quando abrir'}
                </motion.button>
              ) : (
                <div className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/50 font-black uppercase tracking-widest text-[10px] text-center">
                  {loading ? 'Carregando...' : 'Assinatura disponível em breve'}
                </div>
              )}

              {!isPaidPro && billingAvailable() && !info?.launch && (
                <button onClick={handleRestore} disabled={busy !== null} className="w-full py-2 text-white/40 hover:text-white font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2">
                  {busy === 'restore' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                  Já assinei — restaurar compra
                </button>
              )}

              {message && (
                <p role="status" data-testid="planos-msg" className={`text-center text-[11px] font-black leading-relaxed ${message.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {message.text}
                </p>
              )}

              {!viaStore && (codeOpen ? (
                <div className="flex gap-2" data-testid="codigo-pro">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && handleCode()}
                    placeholder="Digite seu código" maxLength={32} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                    className="flex-1 min-w-0 bg-black/30 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black tracking-widest text-white outline-none focus:border-emerald-400/50 placeholder:text-white/30 placeholder:tracking-normal placeholder:font-bold" />
                  <button onClick={handleCode} disabled={!code.trim() || busy !== null}
                    className="shrink-0 px-4 rounded-2xl bg-white/10 border border-white/15 text-white font-black uppercase tracking-widest text-[10px] disabled:opacity-40 flex items-center gap-1.5">
                    {busy === 'code' && <Loader2 size={12} className="animate-spin" />} Usar
                  </button>
                </div>
              ) : (
                <button onClick={() => { setCodeOpen(true); setMessage(null); }} className="w-full py-2 text-white/50 hover:text-white font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2">
                  <Ticket size={12} /> Tenho um código de Pro
                </button>
              ))}
            </div>

            <p className="relative text-[10px] text-white/40 font-bold leading-relaxed">
              Cobrança mensal pela sua conta Google Play, renovada automaticamente até você cancelar.
              Cancele a qualquer momento em Google Play → Pagamentos e assinaturas; o Pro continua até o fim do período já pago.
            </p>
          </motion.div>

          {/* GRATUITO */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-[3rem] p-8 shadow-xl space-y-6 md:order-1"
          >
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 text-emerald-400 flex items-center justify-center">
                <LifeBuoy size={22} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Gratuito</h2>
              <p className="text-3xl font-black text-white tracking-tighter">R$ 0</p>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Para sempre</p>
            </div>
            <FeatureList items={FREE_FEATURES} dark />
            {!loading && !isPaidPro && !info?.launch && (
              <div className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/50 font-black uppercase tracking-widest text-[10px] text-center">
                Seu plano atual
              </div>
            )}
          </motion.div>
        </div>

        {info && (
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 shadow-sm">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Seu uso hoje</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-black text-white tracking-tighter">
                  {info.usage.porto_message}
                  <span className="text-sm text-white/40"> / {info.effective === 'pro' ? '∞' : info.limits.free.porto_message}</span>
                </p>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Mensagens no Porto</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white tracking-tighter">
                  {info.usage.arena_feedback}
                  <span className="text-sm text-white/40"> / {info.effective === 'pro' ? '∞' : info.limits.free.arena_feedback}</span>
                </p>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Retornos da Arena</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
