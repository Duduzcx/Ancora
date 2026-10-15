// Farol: transforma o humor registrado e os Logs dos últimos dias em leituras reais.
// Nada aqui é inventado: sem dados suficientes, o Farol diz isso e explica como aprender mais.

import { createClient } from '@/lib/supabase-client';
import { todayKey, type Mood } from '@/lib/norica-api';

export const MOOD_LABEL: Record<Mood, string> = {
  calmo: 'Calmo',
  ansioso: 'Ansioso',
  agitado: 'Agitado',
  sos: 'S.O.S',
};

export const MOOD_COLOR: Record<Mood, string> = {
  calmo: '#10b981',
  ansioso: '#f59e0b',
  agitado: '#f43f5e',
  sos: '#3b82f6',
};

// Mesmos hábitos da aba Logs (ids 1–21).
const TASK_LABELS: Record<number, string> = {
  1: 'Bebi água', 2: 'Comi algo nutritivo', 3: 'Tomei banho', 4: 'Vesti roupa limpa',
  5: 'Tomei medicamentos', 6: 'Fiz um alongamento', 7: 'Respirei fundo', 8: 'Fiquei longe das telas',
  9: 'Anotei uma gratidão', 10: 'Fiz 5 minutos de silêncio', 11: 'Reconheci o meu esforço',
  12: 'Abri a janela', 13: 'Arrumei a cama', 14: 'Organizei meu espaço', 15: 'Lavei a louça',
  16: 'Coloquei o lixo fora', 17: 'Falei com alguém', 18: 'Escutei música boa',
  19: 'Saí de casa um pouco', 20: 'Evitei conflitos', 21: 'Pedi ajuda se precisei',
};

export type DayMood = { day: string; label: string; mood: Mood | null };

export type FarolReading = {
  week: DayMood[];
  month: DayMood[]; // últimos 30 dias (Farol do plano Pro)
  latestMood: Mood | null;
  insights: { norte: string; brilho: string; protecao: string; tendencia: string };
  hasData: boolean;
};

function dayKeyFromISO(iso: string): string {
  return todayKey(new Date(iso));
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(todayKey(d));
  }
  return days;
}

const EMPTY: FarolReading = {
  week: lastNDays(7).map(day => ({ day, label: weekdayLabel(day), mood: null })),
  month: lastNDays(30).map(day => ({ day, label: day.slice(8), mood: null })),
  latestMood: null,
  hasData: false,
  insights: {
    norte: 'Marque como está o seu mar na Início para o Farol começar a enxergar seus padrões.',
    brilho: 'Cada dia com pelo menos um hábito marcado nos Logs acende uma luz aqui.',
    protecao: 'Com alguns dias de registro, o Farol mostra quais hábitos aparecem nos seus dias mais calmos.',
    tendencia: 'Em duas semanas de uso, você verá se sua constância está subindo ou descendo.',
  },
};

function weekdayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3);
}

export async function loadFarolReading(): Promise<FarolReading> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return EMPTY;
  const userId = session.user.id;

  const days30 = lastNDays(30);
  const days14 = days30.slice(16);
  const days7 = days14.slice(7);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: moods }, { data: logs }, { data: aiDays }] = await Promise.all([
    supabase.from('mood_logs').select('mood, created_at').eq('user_id', userId)
      .gte('created_at', since.toISOString()).order('created_at', { ascending: true }),
    supabase.from('habit_logs').select('day, completed, progress').eq('user_id', userId)
      .gte('day', days30[0]),
    // Resumo do dia feito pela IA a partir das conversas do Porto.
    supabase.from('daily_logs').select('date, humor').eq('user_id', userId).gte('date', days30[0]),
  ]);

  const moodByDay = new Map<string, Mood>();
  // Primeiro o humor percebido pela IA; o humor marcado pela própria pessoa vence quando existir.
  for (const d of aiDays ?? []) if (d.humor) moodByDay.set(d.date, d.humor as Mood);
  for (const m of moods ?? []) moodByDay.set(dayKeyFromISO(m.created_at), m.mood as Mood); // último do dia vence
  const logByDay = new Map<string, { completed: number[]; progress: number }>();
  for (const l of logs ?? []) logByDay.set(l.day, { completed: l.completed ?? [], progress: Number(l.progress) || 0 });

  const week: DayMood[] = days7.map(day => ({ day, label: weekdayLabel(day), mood: moodByDay.get(day) ?? null }));
  const month: DayMood[] = days30.map(day => ({ day, label: day.slice(8), mood: moodByDay.get(day) ?? null }));
  const latestMood = (moods && moods.length) ? (moods[moods.length - 1].mood as Mood) : null;
  const hasData = (moods?.length ?? 0) > 0 || (logs?.length ?? 0) > 0 || (aiDays?.length ?? 0) > 0;
  if (!hasData) return { ...EMPTY, week, month };

  // Norte: humor mais frequente da semana.
  const counts = new Map<Mood, number>();
  for (const d of week) if (d.mood) counts.set(d.mood, (counts.get(d.mood) ?? 0) + 1);
  const [topMood, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const norte = topMood
    ? `Nos últimos 7 dias, seu mar esteve ${MOOD_LABEL[topMood].toLowerCase()} em ${topCount} ${topCount === 1 ? 'dia' : 'dias'}.` +
      (topMood === 'agitado' || topMood === 'sos' || topMood === 'ansioso'
        ? ' Uma pausa de respiração por dia pode ajudar a baixar a maré.'
        : ' Continue cuidando do que te traz calma.')
    : 'Você ainda não marcou seu humor esta semana. Toque em um dos cards na Início.';

  // Brilho: constância nos Logs.
  const activeDays = days7.filter(d => (logByDay.get(d)?.progress ?? 0) > 0).length;
  const brilho = activeDays > 0
    ? `Você cuidou de si em ${activeDays} de 7 dias. ${activeDays >= 5 ? 'Que constância bonita.' : 'Cada pérola conta.'}`
    : 'Nenhum hábito marcado nos últimos 7 dias. Que tal começar com "Bebi água"?';

  // Proteção: hábito mais presente nos dias calmos.
  const calmDays = days14.filter(d => moodByDay.get(d) === 'calmo');
  const freq = new Map<number, number>();
  for (const d of calmDays) for (const id of logByDay.get(d)?.completed ?? []) freq.set(id, (freq.get(id) ?? 0) + 1);
  const [bestId, bestCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const protecao = bestId && bestCount >= 2
    ? `"${TASK_LABELS[bestId]}" apareceu em ${bestCount} dos seus dias calmos. Pode ser um dos seus portos seguros.`
    : 'Ainda não há dias calmos com hábitos suficientes para comparar. Continue registrando os dois.';

  // Tendência: média de progresso desta semana x semana anterior.
  const avg = (ds: string[]) => ds.reduce((s, d) => s + (logByDay.get(d)?.progress ?? 0), 0) / ds.length;
  const now = avg(days7);
  const before = avg(days14.slice(0, 7));
  const diff = Math.round(now - before);
  const tendencia = before === 0 && now === 0
    ? 'Sem registros suficientes nos Logs para comparar semanas.'
    : diff > 3
      ? `Seus Logs subiram ${diff} pontos em relação à semana passada.`
      : diff < -3
        ? `Seus Logs caíram ${Math.abs(diff)} pontos em relação à semana passada. Seja gentil consigo.`
        : 'Seus Logs estão estáveis em relação à semana passada.';

  return { week, month, latestMood, hasData, insights: { norte, brilho, protecao, tendencia } };
}

export { EMPTY as EMPTY_FAROL };
