// Meditações guiadas da Nórica. O mesmo texto é usado no app (legenda e voz do celular)
// e no servidor (voz natural gerada uma vez e reaproveitada por todo mundo).
// Cada trecho tem uma pausa em silêncio depois (em segundos).

export type Meditacao = {
  id: string;
  title: string;
  desc: string;
  minutes: number;
  emoji: string;
  sound: "mar" | "chuva" | "floresta" | "marrom" | "lareira";
  parts: { t: string; p: number }[];
};

export const MEDITACOES: Meditacao[] = [
  {
    id: "mar",
    title: "Respiração do mar",
    desc: "Três minutos acompanhando o vai e vem da respiração, como ondas.",
    minutes: 3,
    emoji: "🌊",
    sound: "mar",
    parts: [
      { t: "Oi. Que bom que você tirou esse tempo para você. Ajeite o corpo do jeito que ficar confortável.", p: 4 },
      { t: "Se quiser, feche os olhos. Ou deixe o olhar descansar em algum ponto à sua frente.", p: 4 },
      { t: "Agora, só perceba a sua respiração, do jeito que ela está. Sem mudar nada.", p: 8 },
      { t: "Imagine que cada vez que o ar entra, uma onda chega na areia. E cada vez que o ar sai, a onda volta para o mar.", p: 10 },
      { t: "Inspire devagar, contando até quatro.", p: 5 },
      { t: "E solte o ar com calma, contando até seis.", p: 7 },
      { t: "De novo. A onda chega.", p: 5 },
      { t: "E a onda volta.", p: 7 },
      { t: "Se a cabeça for para outro lugar, tudo bem. É o que as mentes fazem. Só volte, com gentileza, para a próxima onda.", p: 14 },
      { t: "Continue nesse ritmo, no seu tempo.", p: 20 },
      { t: "Perceba como o seu corpo está agora. Talvez um pouco mais leve. Talvez igual. Os dois estão certos.", p: 8 },
      { t: "Quando quiser, mexa os dedos das mãos, abra os olhos e volte devagar. Obrigada por cuidar de você.", p: 2 },
    ],
  },
  {
    id: "ansiedade",
    title: "Para a ansiedade agora",
    desc: "Quando o coração acelera: chão firme, respiração longa e o momento presente.",
    minutes: 3,
    emoji: "⚓",
    sound: "chuva",
    parts: [
      { t: "Você está aqui, e está tudo bem não estar bem agora. Essa sensação é forte, mas ela passa.", p: 4 },
      { t: "Coloque os dois pés no chão. Sinta o chão te segurando.", p: 6 },
      { t: "Agora vamos deixar a expiração mais longa que a inspiração. Isso avisa o corpo que ele pode desacelerar.", p: 3 },
      { t: "Puxe o ar pelo nariz, contando até quatro.", p: 5 },
      { t: "Segure um pouquinho.", p: 2 },
      { t: "E solte pela boca, bem devagar, como se soprasse uma vela sem apagar.", p: 8 },
      { t: "Mais uma vez. Inspira.", p: 5 },
      { t: "E solta, longo.", p: 8 },
      { t: "Olhe ao seu redor e encontre três coisas que você consegue ver. Só repare nelas, sem pressa.", p: 12 },
      { t: "Agora, duas coisas que você consegue ouvir.", p: 10 },
      { t: "E uma coisa que você consegue sentir na pele: a roupa, o ar, as mãos.", p: 10 },
      { t: "Você atravessou esse momento. O seu corpo está voltando para a calma, no tempo dele.", p: 6 },
      { t: "Se continuar pesado, fale com alguém de confiança ou com a Nórica. E se precisar, o CVV atende vinte e quatro horas no cento e oitenta e oito.", p: 2 },
    ],
  },
  {
    id: "corpo",
    title: "Escaneamento do corpo",
    desc: "Cinco minutos soltando a tensão, da cabeça aos pés.",
    minutes: 5,
    emoji: "🧘",
    sound: "floresta",
    parts: [
      { t: "Vamos passear pelo corpo com atenção e gentileza, soltando o que der para soltar.", p: 4 },
      { t: "Respire fundo uma vez e deixe o ar sair devagar.", p: 7 },
      { t: "Comece pela testa. Deixe ela ficar lisinha, sem franzir.", p: 8 },
      { t: "Solte o maxilar. Deixe os dentes se afastarem um pouco.", p: 8 },
      { t: "Agora os ombros. Deixe eles descerem, para longe das orelhas.", p: 10 },
      { t: "Perceba os braços pesados, as mãos soltas.", p: 10 },
      { t: "Sinta o peito subindo e descendo com a respiração.", p: 10 },
      { t: "Leve a atenção para a barriga. Ela pode ficar macia, sem precisar segurar nada.", p: 10 },
      { t: "Agora o quadril e as pernas, apoiados.", p: 10 },
      { t: "E por fim os pés. Sinta o contato deles com o chão ou com a cama.", p: 10 },
      { t: "Se encontrar algum ponto ainda tenso, mande o ar para lá e, ao soltar, imagine a tensão indo embora.", p: 15 },
      { t: "Fique um pouco assim, sentindo o corpo inteiro respirar.", p: 25 },
      { t: "Quando estiver pronto, espreguice devagar e volte para o seu dia, um pouco mais leve.", p: 2 },
    ],
  },
  {
    id: "dormir",
    title: "Para dormir",
    desc: "Para quando o sono não vem: desacelerar a mente e deixar o corpo pesar.",
    minutes: 6,
    emoji: "🌙",
    sound: "marrom",
    parts: [
      { t: "Hora de descansar. Deite do jeito mais confortável e deixe o celular de lado, com a tela para baixo.", p: 6 },
      { t: "O dia já passou. O que ficou para fazer pode esperar até amanhã.", p: 8 },
      { t: "Respire devagar, deixando a expiração mais longa.", p: 10 },
      { t: "Sinta o corpo ficando pesado, afundando no colchão.", p: 12 },
      { t: "Se aparecer um pensamento, imagine que ele é uma folha boiando num rio. Você vê a folha passar, e deixa ela ir.", p: 18 },
      { t: "Não precisa dormir agora. Só descansar já é bom para o corpo.", p: 15 },
      { t: "A cada respiração, um pouco mais devagar.", p: 20 },
      { t: "O som do lado de fora pode continuar. Você não precisa fazer nada com ele.", p: 20 },
      { t: "Você está seguro, deitado, descansando.", p: 25 },
      { t: "Boa noite.", p: 2 },
    ],
  },
  {
    id: "gentileza",
    title: "Gentileza consigo",
    desc: "Para dias de cobrança: falar consigo como falaria com alguém que você ama.",
    minutes: 4,
    emoji: "💛",
    sound: "lareira",
    parts: [
      { t: "Hoje vamos praticar algo que parece simples, mas é difícil: ser gentil com você mesmo.", p: 4 },
      { t: "Coloque uma mão no peito, se fizer sentido. Sinta o calor da sua própria mão.", p: 8 },
      { t: "Pense em algo que tem pesado para você. Não precisa ser o mais difícil. Algo pequeno já serve.", p: 10 },
      { t: "Repare como o corpo fica quando você pensa nisso.", p: 8 },
      { t: "Agora diga para você, em pensamento: isso é difícil. E está tudo bem sentir isso.", p: 8 },
      { t: "Muita gente sente algo parecido. Você não está sozinho nisso.", p: 8 },
      { t: "Se um amigo querido estivesse passando pelo mesmo, o que você diria para ele?", p: 12 },
      { t: "Agora tente dizer essas mesmas palavras para você.", p: 15 },
      { t: "Você está fazendo o que consegue, com o que tem hoje. Isso já é muito.", p: 10 },
      { t: "Respire fundo mais uma vez e leve um pouco dessa gentileza para o resto do dia.", p: 2 },
    ],
  },
];

export const meditacaoById = (id: string) => MEDITACOES.find((m) => m.id === id) ?? null;
