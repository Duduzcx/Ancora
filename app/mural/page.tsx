"use client";

// Mural de vitórias: tudo o que a pessoa já conquistou num lugar só,
// para reler quando bater o "eu não avancei nada".

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Route, Mail, Heart, Flame, Sparkles } from 'lucide-react';
import { BADGES } from '@/components/Conquistas';
import { noricaApi, type AchievementStats, type JournalEntry } from '@/lib/norica-api';
import { getAuthState } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';
import { TRACKS, getTracks } from '@/lib/trilhas';
import { lettersMeta } from '@/lib/cartas';

export default function MuralPage() {
  const router = useRouter();
  const uid = getAuthState().user?.id;
  const [stats, setStats] = useState<AchievementStats | null>(() => cacheGet<AchievementStats>(uid, 'achievements'));
  const [gratitude, setGratitude] = useState<JournalEntry[] | null>(null);
  const [tracksDone, setTracksDone] = useState<string[]>([]);
  const [lettersRead, setLettersRead] = useState(0);

  useEffect(() => {
    noricaApi.achievements().then(({ stats: s }) => { setStats(s); cacheSet(uid, 'achievements', s); }).catch(() => {});
    noricaApi.journalList(12, 'gratidao').then(({ entries }) => setGratitude(entries)).catch(() => setGratitude([]));
    const t = getTracks();
    setTracksDone(TRACKS.filter((tr) => (t.tracks[tr.id]?.done.length ?? 0) >= tr.steps.length).map((tr) => `${tr.emoji} ${tr.title}`));
    setLettersRead(lettersMeta().filter((l) => l.opened).length);
  }, []);

  const unlocked = stats ? BADGES.filter((b) => b.value(stats) >= b.goal) : [];

  return (
    <main className="min-h-[100dvh] bg-[#0b0a06] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="mural">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.14)_0%,transparent_60%)]" />
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-amber-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-amber-200/80 uppercase tracking-[0.25em]">Mural de vitórias</span>
        </div>
        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Olha o quanto <span className="text-amber-300 italic">você já fez.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">Para os dias em que parece que nada mudou.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 stagger-in">
          <Tile icon={Flame} n={stats?.bestStreak ?? 0} label="maior sequência de dias" />
          <Tile icon={Sparkles} n={stats?.careDays ?? 0} label="dias cuidando de você" />
          <Tile icon={Heart} n={stats?.gratidao ?? 0} label="listas de coisas boas" />
          <Tile icon={Mail} n={lettersRead} label="cartas lidas do seu eu do passado" />
        </div>

        {unlocked.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5"><Trophy size={12} /> Conquistas</p>
            <div className="flex flex-wrap gap-2">
              {unlocked.map((b) => (
                <span key={b.id} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-400/10 border border-amber-300/25 text-xs font-bold text-amber-100 badge-glow"><b.icon size={13} /> {b.title}</span>
              ))}
            </div>
          </section>
        )}

        {tracksDone.length > 0 && (
          <section className="space-y-2">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5"><Route size={12} /> Trilhas completas</p>
            {tracksDone.map((t) => <p key={t} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold">{t}</p>)}
          </section>
        )}

        <section className="space-y-2">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5"><Heart size={12} /> Coisas boas que você anotou</p>
          {gratitude === null && <div className="skeleton h-16 rounded-2xl" />}
          {gratitude && gratitude.length === 0 && (
            <button onClick={() => router.push('/exercicios/?ex=gratidao')} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-sm font-semibold text-white/60 text-left">Ainda nada aqui. Que tal anotar três coisas boas de hoje? →</button>
          )}
          {gratitude?.map((g) => (
            <div key={g.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-black text-amber-200/60 uppercase tracking-widest">{new Date(g.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
              <p className="text-sm text-white/85 font-semibold leading-relaxed whitespace-pre-line mt-1">{g.content}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Tile({ icon: Icon, n, label }: { icon: any; n: number; label: string }) {
  return (
    <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10">
      <Icon size={18} className="text-amber-300 mb-2" />
      <p className="text-3xl font-black tracking-tighter tabular-nums">{n}</p>
      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-tight mt-1">{label}</p>
    </div>
  );
}
