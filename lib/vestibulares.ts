// Datas dos principais exames (confira todo ano nos sites oficiais e atualize aqui).
// ENEM 2026: Inep (8 e 15/11/2026). Vestibulinho ETEC 1º sem. 2027: prova 6/12/2026, resultado 11/01/2027.

export type Exame = { id: string; nome: string; dia: string; hora?: string; tipo: 'enem' | 'etec' | 'outro'; detalhe: string };

export const EXAMES: Exame[] = [
  { id: 'enem26-1', nome: 'ENEM — 1º dia', dia: '2026-11-08', hora: '13:30', tipo: 'enem', detalhe: 'Linguagens, Redação e Ciências Humanas' },
  { id: 'enem26-2', nome: 'ENEM — 2º dia', dia: '2026-11-15', hora: '13:30', tipo: 'enem', detalhe: 'Ciências da Natureza e Matemática' },
  { id: 'etec27-1', nome: 'Vestibulinho ETEC', dia: '2026-12-06', hora: '13:30', tipo: 'etec', detalhe: 'Prova do 1º semestre de 2027' },
  { id: 'etec27-r', nome: 'Resultado ETEC', dia: '2027-01-11', tipo: 'etec', detalhe: 'Classificação geral (previsão)' },
];

const iso = (d = new Date()) => d.toLocaleDateString('en-CA');
export function diasAte(dia: string, hoje = iso()) {
  return Math.round((new Date(`${dia}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000);
}
/** Próximos exames (de hoje em diante), opcionalmente só de um tipo. */
export function proximosExames(tipo?: Exame['tipo']) {
  const hoje = iso();
  return EXAMES.filter((e) => e.dia >= hoje && (!tipo || e.tipo === tipo)).sort((a, b) => a.dia.localeCompare(b.dia));
}
