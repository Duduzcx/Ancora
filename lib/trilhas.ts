"use client";

// Trilhas de 7 dias: um passo curto por dia, com um objetivo claro.
// O progresso fica no aparelho (por conta) e um aviso às 19h lembra do passo do dia.

import { cacheGet, cacheSet } from '@/lib/cache';
import { getAuthState } from '@/lib/auth-store';
import { scheduleNotices, cancelNotices } from '@/lib/reminder';

export type TrackStep = { title: string; text: string; action: string; link?: { href: string; label: string } };
export type Track = { id: string; title: string; subtitle: string; emoji: string; color: string; steps: TrackStep[] };

export const TRACKS: Track[] = [
  {
    id: 'prova',
    title: 'Ansiedade antes da prova',
    subtitle: 'Chegar no dia da prova mais preparado(a) por dentro',
    emoji: '📚',
    color: 'amber',
    steps: [
      { title: 'Dar nome ao medo', text: 'Ansiedade cresce quando fica vaga. Escrever exatamente o que preocupa deixa o problema do tamanho real.', action: 'Escreva em uma frase: "O que mais me preocupa na prova é…"', link: { href: '/porto/?humor=ansioso', label: 'Contar para a Nórica' } },
      { title: 'Respirar antes de estudar', text: 'Um minuto de respiração lenta avisa o corpo que não há perigo agora — e a cabeça aprende melhor assim.', action: 'Faça 4 ciclos de respiração 4-7-8 antes de abrir o material.', link: { href: '/respiracao/', label: 'Abrir respiração' } },
      { title: 'Blocos de 25 minutos', text: 'Estudar em blocos curtos com pausas rende mais do que horas seguidas cansado(a).', action: 'Faça 2 blocos de 25 minutos com 5 de pausa (água e alongar).' },
      { title: 'Sono também é estudo', text: 'É dormindo que a memória guarda o que você estudou. Virar a noite costuma piorar a nota.', action: 'Escolha um horário para deitar hoje e guarde o celular 30 minutos antes.', link: { href: '/noite/', label: 'Modo noite' } },
      { title: 'Do "e se…" ao "o que posso"', text: '"E se eu for mal?" não tem resposta. "O que posso fazer hoje?" tem.', action: 'Troque um "e se…" de hoje por uma ação pequena e faça.' },
      { title: 'Um truque para a hora H', text: 'Se der branco na prova, voltar aos sentidos acalma em segundos.', action: 'Treine o aterramento 5-4-3-2-1 uma vez hoje.', link: { href: '/exercicios/?ex=aterramento', label: 'Treinar agora' } },
      { title: 'Plano do dia', text: 'Decidir as coisas antes tira peso da manhã da prova.', action: 'Separe documento, caneta e água, combine o horário de sair e escolha uma frase de coragem.' },
    ],
  },
  {
    id: 'sono',
    title: 'Dormir melhor',
    subtitle: 'Pequenos ajustes que ajudam o sono a voltar',
    emoji: '🌙',
    color: 'indigo',
    steps: [
      { title: 'Hora fixa para acordar', text: 'O relógio do corpo se ajusta pelo horário de acordar, mais do que pelo de dormir.', action: 'Escolha um horário para acordar e use todos os dias desta semana, inclusive no fim de semana.' },
      { title: 'Uma hora sem telas', text: 'A luz e o conteúdo das telas deixam a mente acesa.', action: 'Hoje, deixe o celular longe 1 hora antes de deitar (pode ouvir um som).', link: { href: '/noite/', label: 'Sons para dormir' } },
      { title: 'Esvaziar a mente', text: 'Pensamentos rodando na cabeça mantêm o corpo em alerta.', action: 'Antes de deitar, escreva tudo o que está pendente no Modo noite.', link: { href: '/noite/', label: 'Esvaziar a mente' } },
      { title: 'Café só até as 14h', text: 'A cafeína pode ficar no corpo por 6 horas ou mais.', action: 'Hoje, nada de café, chá preto, mate ou energético depois das 14h.' },
      { title: 'Sol de manhã', text: 'Luz natural pela manhã ajuda o corpo a ter sono na hora certa à noite.', action: 'Fique 10 minutos na luz do dia antes do meio-dia.' },
      { title: 'Cama é para dormir', text: 'Se o sono não vem, ficar rolando ensina o cérebro que cama é lugar de preocupação.', action: 'Se passar de 20 minutos acordado(a), levante, fique no escuro e volte quando o sono chegar.' },
      { title: 'Seu ritual', text: 'Repetir os mesmos passos toda noite avisa o corpo que é hora de desligar.', action: 'Monte seu ritual de 15 minutos: luz baixa, respiração lenta e um som calmo.', link: { href: '/noite/', label: 'Abrir Modo noite' } },
    ],
  },
  {
    id: 'gentileza',
    title: 'Gentileza consigo',
    subtitle: 'Trocar a cobrança por cuidado, um dia de cada vez',
    emoji: '💚',
    color: 'emerald',
    steps: [
      { title: 'Fale como falaria com um amigo', text: 'A gente costuma ser bem mais duro consigo do que com quem ama.', action: 'Pegue uma crítica que você se fez hoje e reescreva como diria a um amigo.' },
      { title: 'Três coisas boas', text: 'O cérebro guarda mais o que deu errado. Dá para treinar o olhar.', action: 'Anote três coisas boas de hoje, mesmo pequenas.', link: { href: '/exercicios/?ex=gratidao', label: 'Anotar agora' } },
      { title: 'Pausa sem culpa', text: 'Descansar também é produtivo: é o que permite continuar.', action: 'Tire 5 minutos só para você, sem tela e sem se cobrar.' },
      { title: 'Esforço, não só resultado', text: 'Reconhecer o esforço mantém a motivação mesmo quando o resultado demora.', action: 'Diga para você uma coisa que se esforçou para fazer hoje.' },
      { title: 'Um "não" gentil', text: 'Limites protegem sua energia e suas relações.', action: 'Diga um "não" (ou "agora não") para algo que te sobrecarrega.', link: { href: '/exercicios/?ex=conversa', label: 'Preparar a conversa' } },
      { title: 'Cuidar do corpo', text: 'Corpo cuidado deixa a cabeça mais leve.', action: 'Marque nos Logs: água, alongamento e uma refeição com calma.', link: { href: '/log/', label: 'Abrir Logs' } },
      { title: 'Uma carta para você', text: 'Seu eu do futuro vai gostar de saber como você está hoje.', action: 'Escreva uma carta para você ler daqui a 30 dias.', link: { href: '/cartas/', label: 'Escrever carta' } },
    ],
  },
  {
    id: 'cuidador',
    title: 'Quem cuida também precisa de cuidado',
    subtitle: 'Para quem cuida de um familiar, filho ou pessoa doente',
    emoji: '🤲',
    color: 'sky',
    steps: [
      { title: 'Reconhecer o peso', text: 'Cuidar de alguém cansa — e sentir cansaço, raiva ou tristeza não te faz uma pessoa ruim.', action: 'Escreva uma frase sobre o que mais pesa no cuidado hoje, sem se julgar.', link: { href: '/porto/', label: 'Desabafar com a Nórica' } },
      { title: '15 minutos só seus', text: 'Pequenas pausas protegem quem cuida de esgotar.', action: 'Reserve 15 minutos hoje para algo só seu: um café, uma música, um banho sem pressa.' },
      { title: 'Pedir uma ajuda pequena', text: 'Ninguém aguenta sozinho. Pedidos específicos são mais fáceis de aceitar.', action: 'Peça a alguém uma ajuda concreta: "Você pode ficar com ela das 14h às 16h no sábado?"', link: { href: '/exercicios/?ex=conversa', label: 'Preparar o pedido' } },
      { title: 'Corpo de quem cuida', text: 'Quem cuida costuma esquecer de comer, beber água e dormir.', action: 'Marque nos Logs três cuidados com você hoje.', link: { href: '/log/', label: 'Abrir Logs' } },
      { title: 'O que está nas suas mãos', text: 'Separar o que dá para mudar do que não dá alivia a culpa.', action: 'Liste uma coisa que você controla no cuidado e uma que não controla.' },
      { title: 'Rede de apoio', text: 'Grupos de cuidadores, CRAS e a UBS podem orientar e dividir o peso.', action: 'Anote um lugar ou pessoa que pode te apoiar e salve no seu plano de segurança.', link: { href: '/plano-seguranca/', label: 'Plano de segurança' } },
      { title: 'Gentileza consigo', text: 'Você está fazendo o melhor possível com o que tem.', action: 'Escreva para você o que diria a um amigo que cuida de alguém como você cuida.' },
    ],
  },
  {
    id: 'pais',
    title: 'Pais de primeira viagem',
    subtitle: 'Para os primeiros meses com um bebê em casa',
    emoji: '🍼',
    color: 'rose',
    steps: [
      { title: 'Ninguém nasce sabendo', text: 'Insegurança nos primeiros meses é comum e não diz nada sobre o seu amor.', action: 'Anote uma coisa que você já aprendeu sobre o bebê desde que ele chegou.' },
      { title: 'Dormir quando der', text: 'O sono picado pesa no humor. Cochilos curtos ajudam.', action: 'Combine com alguém um cochilo de 30 minutos para você hoje.' },
      { title: 'Dividir as tarefas', text: 'Uma lista clara evita brigas e cansaço desigual.', action: 'Divida com quem mora com você três tarefas da semana, por escrito.' },
      { title: 'Respirar no choro', text: 'Choro longo é difícil de ouvir. Se precisar, coloque o bebê em lugar seguro e respire um minuto.', action: 'Treine hoje a respiração 4-7-8 para usar nos momentos de choro.', link: { href: '/respiracao/', label: 'Respiração' } },
      { title: 'Um pouco de você', text: 'Você continua sendo você além de pai ou mãe.', action: 'Faça hoje algo pequeno que era seu antes do bebê.' },
      { title: 'Sinais para pedir ajuda', text: 'Tristeza que não passa por mais de duas semanas, falta de vontade de tudo ou pensamentos de se machucar pedem ajuda profissional — pelo SUS, na UBS.', action: 'Salve o contato da UBS ou do seu médico no plano de segurança.', link: { href: '/plano-seguranca/', label: 'Plano de segurança' } },
      { title: 'Celebrar a semana', text: 'Cada semana com um bebê é um grande feito.', action: 'Escreva uma carta para você ler daqui a 3 meses.', link: { href: '/cartas/', label: 'Escrever carta' } },
    ],
  },
  {
    id: 'orgulho',
    title: 'Ser quem você é',
    subtitle: 'Acolhimento para pessoas LGBTQIA+',
    emoji: '🏳️‍🌈',
    color: 'violet',
    steps: [
      { title: 'Você não está sozinho(a)', text: 'Sentir medo, cansaço ou solidão por ser quem você é acontece — e não é culpa sua.', action: 'Escreva uma frase sobre como você está se sentindo hoje, do seu jeito.', link: { href: '/porto/', label: 'Conversar com a Nórica' } },
      { title: 'Lugares seguros', text: 'Ter pessoas e espaços onde você pode ser você protege a saúde mental.', action: 'Anote uma pessoa ou lugar onde você se sente seguro(a) para ser quem é.' },
      { title: 'No seu tempo', text: 'Contar ou não contar, para quem e quando, é decisão sua. Não existe prazo.', action: 'Escreva o que você precisa sentir para dar o próximo passo — ou para não dar agora.' },
      { title: 'Comentários que machucam', text: 'Falas preconceituosas doem. Você pode se proteger e se afastar.', action: 'Prepare uma frase curta para sair de uma conversa que te machuca.', link: { href: '/exercicios/?ex=conversa', label: 'Preparar a frase' } },
      { title: 'Comunidade', text: 'Coletivos, ONGs e centros de cidadania LGBTQIA+ oferecem acolhimento e informação.', action: 'Procure um grupo ou coletivo na sua cidade ou online e salve o contato.' },
      { title: 'Corpo e cuidado', text: 'Você merece um atendimento de saúde que te respeite.', action: 'Anote o nome de um serviço ou profissional que respeita sua identidade (ou que você quer conhecer).' },
      { title: 'Orgulho de existir', text: 'Ser você, num mundo que às vezes não facilita, é força.', action: 'Escreva três coisas de que você gosta em você.' },
    ],
  },
];

export type TrackProgress = { started: string; done: string[] }; // done = dias (AAAA-MM-DD) em que cada passo foi feito
export type TracksState = { active: string | null; tracks: Record<string, TrackProgress> };
const EMPTY: TracksState = { active: null, tracks: {} };
const KEY = 'trilhas';
const NOTICE_BASE = 7500;

export const today = () => new Date().toLocaleDateString('en-CA');
const uid = () => getAuthState().user?.id;

export function getTracks(): TracksState {
  return cacheGet<TracksState>(uid(), KEY) ?? EMPTY;
}
function saveTracks(s: TracksState) {
  cacheSet(uid(), KEY, s);
  try { window.dispatchEvent(new CustomEvent('norica-trilhas')); } catch (_e) {}
}

export function trackById(id: string | null | undefined) {
  return TRACKS.find((t) => t.id === id) ?? null;
}

/** Passo de hoje: o próximo não feito. Um passo por dia. */
export function todayStep(state = getTracks()) {
  const track = trackById(state.active);
  if (!track) return null;
  const p = state.tracks[track.id];
  if (!p) return null;
  const index = p.done.length;
  if (index >= track.steps.length) return { track, index, step: null, doneToday: true, finished: true };
  const doneToday = p.done[p.done.length - 1] === today();
  return { track, index: doneToday ? index - 1 : index, step: doneToday ? track.steps[index - 1] : track.steps[index], doneToday, finished: false };
}

async function scheduleTrack(track: Track, fromStep: number) {
  const notices = [];
  // O passo de hoje já está liberado; os avisos chamam para os próximos dias, às 19h.
  for (let i = fromStep + 1, d = 1; i < track.steps.length; i++, d++) {
    const at = new Date();
    at.setDate(at.getDate() + d);
    at.setHours(19, 0, 0, 0);
    notices.push({ id: NOTICE_BASE + i, at, title: `${track.emoji} Dia ${i + 1} de 7: ${track.steps[i].title}`, body: 'O passo de hoje da sua trilha leva poucos minutos.', route: '/trilhas/' });
  }
  await scheduleNotices(notices).catch(() => {});
}

export async function startTrack(id: string) {
  const track = trackById(id);
  if (!track) return;
  const s = getTracks();
  const existing = s.tracks[id];
  const progress = existing && existing.done.length < track.steps.length ? existing : { started: today(), done: [] };
  saveTracks({ active: id, tracks: { ...s.tracks, [id]: progress } });
  await cancelNotices(TRACKS[0].steps.map((_, i) => NOTICE_BASE + i));
  await scheduleTrack(track, progress.done.length);
}

export function completeToday(): boolean {
  const s = getTracks();
  const info = todayStep(s);
  if (!info || info.doneToday || info.finished) return false;
  const p = s.tracks[info.track.id];
  saveTracks({ ...s, tracks: { ...s.tracks, [info.track.id]: { ...p, done: [...p.done, today()] } } });
  return true;
}

export async function leaveTrack() {
  const s = getTracks();
  saveTracks({ ...s, active: null });
  await cancelNotices(TRACKS[0].steps.map((_, i) => NOTICE_BASE + i));
}
