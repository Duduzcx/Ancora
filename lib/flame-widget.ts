"use client";

// Mantém o widget "Foguinho" da tela inicial em dia com a chama mais forte do momento.

import type { FriendsState } from '@/lib/norica-api';

let last = '';

export function updateFlameWidget(state: FriendsState | null) {
  if (!state || !Array.isArray(state.friends)) return;
  const f = [...state.friends].sort((a, b) => (b.streak - a.streak) || Number(b.friendToday) - Number(a.friendToday))[0];
  const o = f
    ? {
        count: String(f.streak),
        title: `${f.streak} ${f.streak === 1 ? 'dia' : 'dias'} com ${f.name}`,
        sub: f.bothToday ? 'Vocês dois marcaram hoje! 🔥' : f.friendToday ? `${f.name} já marcou. Falta você!` : f.meToday ? `Você marcou. Falta ${f.name}.` : 'Ninguém marcou hoje ainda.',
        lit: f.streak > 0,
      }
    : { count: '0', title: 'Foguinho com amigos', sub: 'Toque para acender com alguém 🔥', lit: false };
  const key = JSON.stringify(o);
  if (key === last) return;
  last = key;
  import('@/lib/reminder').then((r) => r.setFlameWidget(o)).catch(() => {});
}
