// Caderno (estudos e ideias): textos para a IA, agenda de revisão e busca nas anotações.
// Funções puras: dá para testar sem banco nem internet.

import { normalize } from "./safety.ts";

export const NOTE_KINDS = ["aprendizado", "ideia", "lembrete"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const GRADES = ["errei", "dificil", "facil"] as const;
export type Grade = (typeof GRADES)[number];

const STUDY_RULES = `
- Responda sempre em português do Brasil, com linguagem simples, como uma boa professora particular paciente.
- Seja fiel ao que a pessoa escreveu: não invente fatos sobre a vida dela.
- Em conteúdo de estudo, seja correta. Se não tiver certeza de um fato, diga que vale conferir no material da aula.
- Nunca dê instruções perigosas (armas, drogas, autolesão), nem em forma de estudo.`;

/** Organiza uma anotação: título, resumo, matéria, etiquetas e (para aprendizados) cartões de revisão. */
export const ORGANIZE_PROMPT = `Você é a Nórica organizando o caderno de estudos e ideias de uma pessoa (estudante ou trabalhador) que tem dificuldade de lembrar das coisas.
Você recebe o tipo da anotação (aprendizado, ideia ou lembrete) e o texto, que pode ter vindo de uma fala transcrita (com erros de fala).
Responda SOMENTE com JSON, sem texto em volta:
{"titulo": "até 6 palavras, claro",
 "resumo": "1 frase curta com a ideia principal",
 "materia": "matéria ou assunto geral em até 3 palavras (ex.: Biologia, Trabalho, Projeto do app). Use a mesma grafia para assuntos iguais",
 "etiquetas": ["até 3 palavras-chave curtas, minúsculas"],
 "cartoes": [{"pergunta": "pergunta curta para relembrar o conteúdo", "resposta": "resposta curta e correta (até 25 palavras)"}]}
Regras dos cartões: só para "aprendizado"; de 1 a 3 cartões; cada um sobre UM fato importante do texto; sem pegadinhas. Para "ideia" e "lembrete", "cartoes" é [].${STUDY_RULES}`;

/** Estudar com a IA: explicação simples, tópicos e um quiz rápido. */
export const EXPLAIN_PROMPT = `Você é a Nórica, uma professora particular paciente dentro de um app de bem-estar. A pessoa pode estar ansiosa com a prova: seja encorajadora sem exagero.
Você recebe um tema OU um texto colado (resumo de aula, trecho de livro). Ensine o essencial.
Responda SOMENTE com JSON, sem texto em volta:
{"titulo": "até 6 palavras",
 "materia": "matéria em até 3 palavras",
 "explicacao": "explicação simples em 2 a 4 parágrafos curtos separados por \\n\\n, com um exemplo do dia a dia",
 "topicos": ["de 3 a 6 pontos-chave, frases curtas"],
 "quiz": [{"pergunta": "...", "opcoes": ["4 opções curtas"], "correta": 0, "porque": "1 frase explicando a resposta certa"}]}
O quiz tem exatamente 3 perguntas, de múltipla escolha, com só uma correta (índice de 0 a 3), variando a posição da correta.${STUDY_RULES}`;

/** Perguntar ao Caderno: responder usando só as anotações da pessoa. */
export const ASK_PROMPT = `Você é a Nórica ajudando a pessoa a lembrar do que ela mesma anotou.
Você recebe a pergunta e algumas anotações numeradas [1], [2]... (as mais parecidas com a pergunta).
Responda em até 5 frases, em português do Brasil, usando SOMENTE o que está nas anotações, e cite de onde tirou com [1], [2]...
Se as anotações não tiverem a resposta, diga com gentileza que não encontrou isso no Caderno e sugira anotar quando descobrir.
Não invente nada que não esteja nas anotações.`;

// ---------------------------------------------------------------------
// Revisão espaçada (versão simples do SM-2)
// ---------------------------------------------------------------------

export type CardSchedule = { ease: number; interval_days: number; reps: number; lapses: number };

/** Próxima revisão do cartão. "errei" volta amanhã; "difícil" cresce devagar; "fácil" cresce rápido. */
export function nextReview(card: CardSchedule, grade: Grade): CardSchedule {
  let { ease, interval_days: interval, reps, lapses } = card;
  if (grade === "errei") {
    return { ease: Math.max(1.3, round2(ease - 0.2)), interval_days: 1, reps: 0, lapses: lapses + 1 };
  }
  if (grade === "dificil") {
    ease = Math.max(1.3, round2(ease - 0.15));
    interval = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2));
  } else {
    ease = Math.min(3.0, round2(ease + 0.05));
    interval = reps === 0 ? 2 : reps === 1 ? 4 : Math.max(interval + 1, Math.round(interval * ease));
  }
  return { ease, interval_days: Math.min(interval, 365), reps: reps + 1, lapses };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Busca nas anotações (o texto é criptografado no banco: a busca roda no servidor, depois de abrir)
// ---------------------------------------------------------------------

const STOP = new Set(("a o as os um uma uns umas de da do das dos e em no na nos nas que qual quais por para pra com sem como " +
  "eu me meu minha voce se sobre isso esse essa este esta ele ela foi era ser ter tem mais menos ao aos ja nao sim muito " +
  "anotei anotado aprendi lembro lembrar sabe sei ou entre quando onde porque").split(" "));

export function terms(text: string): string[] {
  return [...new Set(normalize(text).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length > 2 && !STOP.has(w)))];
}

export type SearchableNote = { id: string; title: string; content: string; summary: string; subject: string; tags: string[] };

/** Ordena as anotações pela semelhança com a pergunta (palavras em comum, título vale mais). */
export function rankNotes<T extends SearchableNote>(notes: T[], query: string, limit = 6): T[] {
  const q = terms(query);
  if (!q.length) return [];
  const scored = notes.map((n) => {
    const title = normalize(`${n.title} ${n.subject} ${n.tags.join(" ")}`);
    const body = normalize(`${n.summary} ${n.content}`);
    let score = 0;
    for (const t of q) {
      const stem = t.length > 5 ? t.slice(0, t.length - 2) : t; // "fotossintese" ~ "fotossintética"
      if (title.includes(stem)) score += 3;
      if (body.includes(stem)) score += 1 + Math.min(2, body.split(stem).length - 2);
    }
    return { n, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.n);
}

// ---------------------------------------------------------------------
// Limpeza do que a IA devolve
// ---------------------------------------------------------------------

export function cleanStr(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function cleanCards(v: unknown, max = 3): { front: string; back: string }[] {
  if (!Array.isArray(v)) return [];
  return v.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    return { front: cleanStr(o.pergunta ?? o.front, 200), back: cleanStr(o.resposta ?? o.back, 300) };
  }).filter((c) => c.front && c.back).slice(0, max);
}

export function cleanQuiz(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.map((q) => {
    const o = (q ?? {}) as Record<string, unknown>;
    const opcoes = Array.isArray(o.opcoes) ? (o.opcoes as unknown[]).map((x) => cleanStr(x, 120)).filter(Boolean).slice(0, 4) : [];
    const correta = Number(o.correta);
    return { pergunta: cleanStr(o.pergunta, 240), opcoes, correta, porque: cleanStr(o.porque, 240) };
  }).filter((q) => q.pergunta && q.opcoes.length >= 2 && Number.isInteger(q.correta) && q.correta >= 0 && q.correta < q.opcoes.length).slice(0, 3);
}
