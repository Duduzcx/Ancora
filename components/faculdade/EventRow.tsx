"use client";

import React from 'react';
import { colorOf, countdown, daysUntil, hhmm, kindOf, prettyDay, type Course, type CourseEvent } from '@/lib/faculdade';

export default function EventRow({ e, course, onClick }: { e: CourseEvent; course: Course | null; onClick: () => void }) {
  const k = kindOf(e.kind); const n = daysUntil(e.day); const col = colorOf(course);
  return (
    <li>
      <button onClick={onClick} className="w-full p-4 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center gap-3 text-left" data-testid="data-item">
        <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: col.soft }}>{k.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-black truncate">{e.title}{e.grade != null ? ` · nota ${e.grade}` : ''}</span>
          <span className="block text-[11px] font-bold truncate" style={{ color: course ? col.text : 'rgba(255,255,255,0.45)' }}>{course?.name ?? 'Geral'} · {prettyDay(e.day)}{e.at_time ? ` · ${hhmm(e.at_time)}` : ''}</span>
        </span>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${e.done ? 'bg-white/5 text-white/40' : n <= 2 && n >= 0 ? 'bg-rose-500/20 text-rose-200' : n < 0 ? 'bg-white/5 text-white/40' : 'bg-white/10 text-white/70'}`}>{e.done ? 'feito' : countdown(e.day)}</span>
      </button>
    </li>
  );
}

