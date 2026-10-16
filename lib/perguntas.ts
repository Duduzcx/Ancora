// Perguntas do dia: um ponto de partida para quem não sabe o que escrever.
// Uma por dia, a mesma para o dia inteiro (troca à meia-noite).

export const DAILY_QUESTIONS = [
  'O que você precisava ouvir hoje?',
  'Qual foi o momento mais leve do seu dia?',
  'O que está ocupando mais espaço na sua cabeça agora?',
  'Por qual pequena coisa você é grato(a) hoje?',
  'O que você fez hoje que exigiu coragem, mesmo que pouca?',
  'Se o seu dia fosse um clima, qual seria? Por quê?',
  'O que você gostaria de deixar para trás hoje?',
  'Quem fez diferença no seu dia, mesmo sem saber?',
  'O que o seu corpo está tentando te dizer hoje?',
  'Qual pensamento se repetiu hoje? Ele é fato ou previsão?',
  'O que você faria hoje se fosse gentil consigo?',
  'O que te deixou orgulhoso(a) nesta semana?',
  'Do que você sente falta ultimamente?',
  'O que te ajudou da última vez que se sentiu assim?',
  'Qual limite você precisou colocar (ou gostaria de ter colocado)?',
  'O que te fez sorrir hoje, mesmo por um segundo?',
  'Se uma amiga vivesse o seu dia, o que você diria a ela?',
  'O que você está esperando com vontade?',
  'O que você aprendeu sobre você recentemente?',
  'O que pode ficar para amanhã, sem culpa?',
  'Qual parte do seu dia você repetiria?',
  'O que está pesando e o que está nas suas mãos sobre isso?',
  'Como você descansou hoje?',
  'Que conversa você está adiando?',
  'Qual foi a sua pequena vitória de hoje?',
  'O que você diria para você de um ano atrás?',
  'O que te acalma quando tudo parece demais?',
  'Qual música combina com o seu dia?',
  'O que você quer lembrar sobre hoje?',
  'Qual é o próximo passo pequeno que você pode dar?',
];

export function todayQuestion(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = Math.floor((date.getTime() - start) / 86400000);
  return DAILY_QUESTIONS[day % DAILY_QUESTIONS.length];
}
