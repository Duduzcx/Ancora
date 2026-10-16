"use client";

// Resumo da semana (Pro): uma carta curta da Nórica sobre como foi a semana.
// No plano Gratuito aparecem só os números da semana e o convite para o Pro.

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { CalendarHeart, Loader2, Lock, Volume2, Square } from 'lucide-react';
import { noricaApi, type WeeklySummary } from '@/lib/norica-api';
import { speak, stopSpeaking, onSpeakingChange } from '@/lib/speech';

export default function ResumoSemanal() {
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await noricaApi.weeklySummary());
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar agora.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const off = onSpeakingChange((id) => setSpeaking(id === 'resumo-semanal'));
    // Veio da notificação de domingo: abre o resumo direto.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('resumo') === '1') {
      load();
      setTimeout(() => document.getElementById('resumo-semanal')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 600);
    }
    return () => { off(); stopSpeaking(); };
  }, []);

  const s = data?.stats;
  const moodsTotal = s ? Object.values(s.moods).reduce((a, b) => a + b, 0) : 0;

  return (
    <motion.div
      id="resumo-semanal"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      className="bg-gradient-to-br from-emerald-950/60 to-white/5 backdrop-blur-md rounded-[3rem] p-8 text-white shadow-2xl border border-emerald-500/20 space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarHeart size={20} className="text-emerald-400" />
          <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">Resumo da semana</h3>
        </div>
        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Pro</span>
      </div>

      {!data && !loading && !error && (
        <>
          <p className="text-sm text-white/70 font-semibold leading-relaxed">
            A Nórica olha sua semana — humor, Logs, conversas e diário — e escreve um resumo com os temas que mais apareceram e o que te ajudou.
          </p>
          <button onClick={load} className="px-5 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px]">
            Ler meu resumo
          </button>
        </>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-white/60 text-sm font-bold py-4">
          <Loader2 size={18} className="animate-spin" /> Escrevendo seu resumo…
        </div>
      )}

      {error && <p className="text-sm font-bold text-rose-300">{error}</p>}

      {data?.empty && (
        <p className="text-sm text-white/60 font-semibold leading-relaxed">
          Ainda não há registros nesta semana. Marque seu mar na Início, converse no Porto ou grave um diário — no domingo seu resumo estará aqui.
        </p>
      )}

      {data && !data.empty && s && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: moodsTotal, l: 'humores' },
            { n: s.daysWithLogs, l: 'dias nos Logs' },
            { n: s.conversations + s.journalEntries, l: 'conversas e diários' },
          ].map((x) => (
            <div key={x.l} className="p-3 rounded-2xl bg-black/25 border border-white/5 text-center">
              <p className="text-xl font-black text-white">{x.n}</p>
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-tight mt-1">{x.l}</p>
            </div>
          ))}
        </div>
      )}

      {data?.summary && (
        <>
          <p className="text-[15px] text-white/85 font-semibold leading-relaxed whitespace-pre-line">{data.summary}</p>
          <button
            onClick={() => (speaking ? stopSpeaking() : speak('resumo-semanal', data.summary!))}
            className="flex items-center gap-1.5 text-[10px] font-black text-white/50 uppercase tracking-widest"
          >
            {speaking ? <Square size={12} /> : <Volume2 size={13} />} {speaking ? 'Parar' : 'Ouvir'}
          </button>
        </>
      )}

      {data?.locked && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-black/25 border border-emerald-500/20">
          <Lock size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/70 font-semibold leading-relaxed">
            O resumo escrito pela Nórica faz parte do <Link href="/planos/" className="text-emerald-400 font-black underline underline-offset-4">Nórica Pro</Link>.
          </p>
        </div>
      )}
    </motion.div>
  );
}
