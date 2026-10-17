// Modelos de campanha das instituições parceiras (texto pronto, editável pela equipe).
// "when" sugere o período do ano: um toque já publica a campanha com essas datas.
import type { CampaignKind, OrgKind } from '@/lib/norica-api';

export type CampaignTemplate = {
  label: string; emoji: string; title: string; message: string;
  action?: { href: string; label: string };
  when?: { month: number; day: number; days: number }; // mês 1–12; dia de início; duração
  for?: OrgKind[]; // só aparece no calendário desse tipo de instituição
};

export const CAMPAIGN_TEMPLATES: Record<CampaignKind, CampaignTemplate> = {
  janeiro: { label: 'Janeiro Branco', emoji: '🤍', title: 'Janeiro Branco: cuidar da mente também é saúde', message: 'Começo de ano é um bom momento para olhar para como você está por dentro. Que tal começar com 1 minuto por dia na Nórica?', action: { href: '/hoje/', label: 'Fazer meu minuto de hoje' }, when: { month: 1, day: 1, days: 31 } },
  voltaaulas: { label: 'Volta às aulas', emoji: '🎒', title: 'Volta às aulas com calma', message: 'Recomeçar a rotina pode dar frio na barriga. Respire, vá um dia de cada vez e conte com a gente.', action: { href: '/trilhas/?t=prova', label: 'Trilha para a rotina de estudos' }, when: { month: 2, day: 1, days: 14 }, for: ['escola'] },
  ansiedade: { label: 'Semana contra a ansiedade', emoji: '🌬️', title: 'Uma semana para respirar', message: 'Ansiedade é comum e tem jeito de acalmar. Experimente a meditação "Para a ansiedade agora" — 3 minutos.', action: { href: '/meditacoes/', label: 'Ouvir a meditação' }, when: { month: 4, day: 7, days: 7 } },
  provas: { label: 'Semana de provas', emoji: '📚', title: 'Semana de provas', message: 'Estudar em blocos curtos, dormir bem e respirar antes de começar fazem diferença. Tem uma trilha de 7 dias para isso.', action: { href: '/trilhas/?t=prova', label: 'Começar a trilha' }, when: { month: 6, day: 15, days: 14 }, for: ['escola'] },
  sono: { label: 'Semana do sono', emoji: '🌙', title: 'Semana do sono', message: 'Dormir bem melhora humor, foco e paciência. Experimente a trilha "Dormir melhor" e a meditação para dormir.', action: { href: '/meditacoes/', label: 'Meditação para dormir' }, when: { month: 3, day: 13, days: 7 } },
  pausa: { label: 'Pausa ativa', emoji: '🌿', title: 'Pausa ativa', message: 'Que tal 3 minutos agora? Levante, beba água e faça uma respiração lenta. Pequenas pausas rendem mais do que horas seguidas.', action: { href: '/movimento/', label: 'Fazer a pausa' }, when: { month: 8, day: 1, days: 7 }, for: ['empresa', 'outro'] },
  setembro: { label: 'Setembro Amarelo', emoji: '💛', title: 'Setembro Amarelo: falar é cuidar', message: 'Se estiver pesado, você não precisa passar por isso sozinho(a). Converse com alguém de confiança ou ligue 188 (CVV, 24h, gratuito).', action: { href: '/porto/', label: 'Conversar com a Nórica' }, when: { month: 9, day: 1, days: 30 } },
  saudemental: { label: 'Dia Mundial da Saúde Mental', emoji: '🧠', title: '10 de outubro: Dia Mundial da Saúde Mental', message: 'Cuidar da mente é parte do dia, como beber água. Faça hoje o seu check-in de 1 minuto.', action: { href: '/hoje/', label: 'Fazer meu minuto' }, when: { month: 10, day: 6, days: 7 } },
  outubrorosa: { label: 'Outubro Rosa', emoji: '🎀', title: 'Outubro Rosa: cuidado que salva', message: 'Mês de lembrar da prevenção do câncer de mama e de acolher quem está em tratamento. Cuidar do corpo e da mente andam juntos.', action: { href: '/porto/', label: 'Conversar' }, when: { month: 10, day: 1, days: 31 }, for: ['empresa', 'outro'] },
  novembroazul: { label: 'Novembro Azul', emoji: '💙', title: 'Novembro Azul: homem também se cuida', message: 'Prevenção e saúde emocional também são coisa de homem. Falar sobre o que pesa é sinal de força.', action: { href: '/porto/', label: 'Conversar' }, when: { month: 11, day: 1, days: 30 }, for: ['empresa', 'outro'] },
  fimdeano: { label: 'Fim de ano gentil', emoji: '✨', title: 'Fim de ano com gentileza', message: 'Final de ano cansa e às vezes pesa. Olhe para o que você conquistou — está tudo no seu Mural de vitórias.', action: { href: '/mural/', label: 'Ver minhas vitórias' }, when: { month: 12, day: 1, days: 21 } },
  livre: { label: 'Mensagem livre', emoji: '📣', title: '', message: '' },
};

/** Próxima data de cada campanha do calendário (este ano, ou o próximo se já passou). */
export function nextWindow(t: CampaignTemplate, today = new Date()): { start: string; end: string } | null {
  if (!t.when) return null;
  const iso = (d: Date) => d.toLocaleDateString('en-CA');
  let y = today.getFullYear();
  let start = new Date(y, t.when.month - 1, t.when.day);
  let end = new Date(start.getTime() + (t.when.days - 1) * 86400_000);
  if (end < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    y += 1;
    start = new Date(y, t.when.month - 1, t.when.day);
    end = new Date(start.getTime() + (t.when.days - 1) * 86400_000);
  }
  const todayIso = iso(today);
  return { start: iso(start) < todayIso ? todayIso : iso(start), end: iso(end) };
}
