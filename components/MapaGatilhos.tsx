"use client";

// Mapa de gatilhos (Farol): o que costuma vir junto dos seus dias difíceis e dos calmos.
// Só com os seus próprios registros — é um espelho, não um diagnóstico.

import React, { useEffect, useState } from 'react';
import { Map as MapIcon, Sprout, CloudRain, CalendarDays, MessageSquareText, Sunrise } from 'lucide-react';
import { noricaApi, type Patterns } from '@/lib/norica-api';
import { TASK_LABELS } from '@/lib/farol';
import { getAuthState } from '@/lib/auth-store';
import { cacheGet, cacheSet } from '@/lib/cache';

export default function MapaGatilhos() {
  const uid = getAuthState().user?.id;
  const [p, setP] = useState<Patterns | null>(() => cacheGet<Patterns>(uid, 'patterns'));
  useEffect(() => {
    noricaApi.patterns().then((r) => { if (typeof r?.enough !== 'boolean') return; setP(r); cacheSet(uid, 'patterns', r); }).catch(() => {});
  }, []);

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-[3rem] p-8 text-white shadow-2xl border border-white/10 space-y-5" data-testid="mapa-gatilhos">
      <div className="flex items-center gap-3">
        <MapIcon size={20} className="text-sky-300" />
        <h3 className="text-sm font-black text-sky-300 uppercase tracking-widest">Mapa do seu mar</h3>
      </div>

      {!p && <div className="space-y-2"><div className="skeleton h-14" /><div className="skeleton h-14" /></div>}

      {p && !p.enough && (
        <p className="text-sm text-white/60 font-semibold leading-relaxed">
          Com {p.needed} dias marcados, a Nórica começa a mostrar o que costuma vir junto dos seus dias calmos e difíceis. Faltam {Math.max(0, p.needed - p.daysMarked)}.
        </p>
      )}

      {p && p.enough && (
        <div className="space-y-3">
          <p className="text-xs text-white/45 font-semibold">Últimos 60 dias · {p.daysMarked} dias marcados ({p.calmDays} calmos, {p.hardDays} difíceis)</p>
          {p.helps.length > 0 && (
            <Row icon={Sprout} tone="text-emerald-300" title="Aparece mais nos seus dias calmos">
              {p.helps.map((h) => `${TASK_LABELS[h.id] ?? 'Hábito'} (em ${h.calm}% dos dias calmos e ${h.hard}% dos difíceis)`).join(' · ')}
            </Row>
          )}
          {p.missing.length > 0 && (
            <Row icon={CloudRain} tone="text-amber-300" title="Costuma aparecer nos dias difíceis">
              {p.missing.map((h) => TASK_LABELS[h.id] ?? 'Hábito').join(' · ')}
            </Row>
          )}
          {p.heavyWeekday && (
            <Row icon={CalendarDays} tone="text-rose-300" title="Dia da semana mais pesado">
              {p.heavyWeekday.day}: {p.heavyWeekday.pct}% das vezes foi um dia difícil. Que tal planejar algo leve para esse dia?
            </Row>
          )}
          {(p.hardTopics.length > 0 || p.feelingsHard.length > 0) && (
            <Row icon={MessageSquareText} tone="text-sky-300" title="Nos dias difíceis, apareceu">
              {[...p.hardTopics, ...p.feelingsHard].join(' · ')}
            </Row>
          )}
          {p.recovery !== null && (
            <Row icon={Sunrise} tone="text-teal-300" title="Depois de um dia difícil">
              Em {p.recovery}% das vezes o dia seguinte foi calmo. Dias difíceis passam. 💙
            </Row>
          )}
          {p.helps.length === 0 && p.missing.length === 0 && !p.heavyWeekday && (
            <p className="text-sm text-white/55 font-semibold">Ainda não apareceu um padrão claro. Continue marcando seu mar e os Logs.</p>
          )}
          <p className="text-[10px] text-white/35 font-semibold">É um espelho dos seus registros, não um diagnóstico. Vale levar para a terapia.</p>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, tone, title, children }: { icon: any; tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-black/25 border border-white/5">
      <Icon size={18} className={`${tone} shrink-0 mt-0.5`} />
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${tone}`}>{title}</p>
        <p className="text-sm text-white/80 font-semibold leading-snug mt-1 first-letter:uppercase">{children}</p>
      </div>
    </div>
  );
}
