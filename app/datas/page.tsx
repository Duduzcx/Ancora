"use client";

// Datas que pesam: dias em que a pessoa quer cuidado extra.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarHeart, Plus, Trash2, Repeat } from 'lucide-react';
import { getDates, newDateId, saveDates, type SensitiveDate } from '@/lib/datas';

const fmt = (d: SensitiveDate) => {
  const [m, day] = d.md.split('-').map(Number);
  const s = new Date(2000, m - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  return d.yearly ? `${s}, todo ano` : `${s} de ${d.year}`;
};

export default function DatasPage() {
  const router = useRouter();
  const [list, setList] = useState<SensitiveDate[]>([]);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [yearly, setYearly] = useState(true);
  useEffect(() => { setList(getDates()); }, []);

  const add = () => {
    if (!date || !label.trim()) return;
    const [y, m, d] = date.split('-');
    const next = [...list, { id: newDateId(), md: `${m}-${d}`, label: label.trim().slice(0, 60), yearly, year: Number(y) }];
    setList(next);
    saveDates(next);
    setDate('');
    setLabel('');
  };
  const remove = (id: string) => { const next = list.filter((x) => x.id !== id); setList(next); saveDates(next); };

  return (
    <main className="min-h-[100dvh] bg-[#06101a] text-white relative overflow-x-hidden pb-40 font-sans" data-testid="datas">
      <div className="relative z-10 max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-3 bg-white/5 border border-white/10 rounded-full text-sky-200" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <span className="text-[9px] font-black text-sky-200/80 uppercase tracking-[0.25em]">Datas que pesam</span>
        </div>
        <div className="space-y-2 page-enter">
          <h1 className="text-4xl font-black tracking-tighter leading-none">Dias para ir <span className="text-sky-300 italic">com calma.</span></h1>
          <p className="text-sm text-white/55 font-semibold leading-relaxed">O aniversário de uma perda, um término, a data de uma prova. Nesses dias a Nórica fica mais atenta e gentil. O motivo nunca aparece na tela bloqueada e fica só no seu celular.</p>
        </div>
        <section className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none [color-scheme:dark]" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="O que essa data lembra? (ex.: aniversário do meu avô)" className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-sky-300/40 placeholder:text-white/25" />
          <button onClick={() => setYearly(!yearly)} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-[11px] font-bold ${yearly ? 'bg-sky-400/15 border-sky-300/30 text-sky-100' : 'border-white/10 text-white/45'}`}>
            <Repeat size={12} /> {yearly ? 'Repete todo ano' : 'Só este ano'}
          </button>
          <button onClick={add} disabled={!date || !label.trim()} className="w-full py-3.5 rounded-2xl bg-sky-400 text-slate-950 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14} /> Guardar data</button>
        </section>
        <ul className="space-y-2">
          {list.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <CalendarHeart size={18} className="text-sky-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate">{d.label}</p>
                <p className="text-[11px] text-white/45 font-semibold">{fmt(d)}</p>
              </div>
              <button onClick={() => remove(d.id)} aria-label="Remover" className="p-1.5 text-white/30"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
