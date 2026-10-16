// Modelos de campanha das instituições parceiras (texto pronto, editável pela equipe).
import type { CampaignKind } from '@/lib/norica-api';

export const CAMPAIGN_TEMPLATES: Record<CampaignKind, { label: string; emoji: string; title: string; message: string; action?: { href: string; label: string } }> = {
  setembro: { label: 'Setembro Amarelo', emoji: '💛', title: 'Setembro Amarelo: falar é cuidar', message: 'Se estiver pesado, você não precisa passar por isso sozinho(a). Converse com alguém de confiança ou ligue 188 (CVV, 24h, gratuito).', action: { href: '/porto/', label: 'Conversar com a Nórica' } },
  provas: { label: 'Semana de provas', emoji: '📚', title: 'Semana de provas', message: 'Estudar em blocos curtos, dormir bem e respirar antes de começar fazem diferença. Tem uma trilha de 7 dias para isso.', action: { href: '/trilhas/?t=prova', label: 'Começar a trilha' } },
  pausa: { label: 'Pausa ativa', emoji: '🌿', title: 'Pausa ativa', message: 'Que tal 3 minutos agora? Levante, beba água e faça uma respiração lenta. Pequenas pausas rendem mais do que horas seguidas.', action: { href: '/respiracao/', label: 'Respirar agora' } },
  sono: { label: 'Semana do sono', emoji: '🌙', title: 'Semana do sono', message: 'Dormir bem melhora humor, foco e paciência. Experimente a trilha "Dormir melhor" e os sons do Modo noite.', action: { href: '/trilhas/?t=sono', label: 'Dormir melhor' } },
  livre: { label: 'Mensagem livre', emoji: '📣', title: '', message: '' },
};
