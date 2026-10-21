# Nórica

App Android (Next.js 16 + Capacitor 8 + Supabase) de apoio emocional, organização de rotina e autoconhecimento.
Pacote na Play Store: `com.zcx.ancora` · deep link de login: `com.zcx.norica://login-callback`.

## Como funciona

| Parte | O que faz | Onde fica |
| --- | --- | --- |
| Início | Cards "Como está o seu mar?" (registra o humor) e atalhos | `app/page.tsx` |
| S.O.S | Neblina para limpar com o dedo + botão de ajuda (CVV 188 / SAMU 192) | `components/NeblinaSOS.tsx`, `components/AjudaAgora.tsx` |
| Porto | Chat com a IA, voz, histórico, tarefas sugeridas → Logs | `app/porto/page.tsx`, `components/ChatHistorySidebar.tsx` |
| Arena | Simulação de conversas difíceis + retorno do treino | `app/arena/page.tsx` |
| Logs | 21 hábitos diários + tarefas da IA, sincronizados na conta | `app/log/page.tsx` |
| Farol | Leitura real de humor + Logs dos últimos 14 dias | `app/farol/page.tsx`, `lib/farol.ts` |
| Cofre | Segredos criptografados, lista e exclusão | `app/cofre/page.tsx` |
| Perfil | Dados, privacidade, excluir conta | `app/perfil/page.tsx` |

Tabelas: `chats` e `messages` (conversas, criptografadas), `daily_logs` (resumo emocional do dia feito pela IA, lido pelo Farol), `habit_logs` (hábitos da aba Logs), `mood_logs` (humor marcado na Início), `vault_entries` (Cofre, criptografado), `consents`, `user_plans`, `usage_events`.

Toda chamada de IA e todo dado sensível passam pelas Edge Functions em `supabase/functions/`:

- `norica` — chat do Porto, Arena, retorno da Arena, histórico, Cofre e exclusão de conta. Exige login, guarda a chave da IA no servidor, criptografa mensagens/títulos/Cofre (AES-256-GCM) e aplica o protocolo de crise antes de responder.
- `norica-transcribe` — transcrição de voz (Whisper na Groq), com login.

O app **não carrega nenhuma chave de IA**. As únicas variáveis públicas são as do Supabase.

## Variáveis de ambiente (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://dtvsxhiwcvhnncbnnxci.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...   # login nativo com Google
```

`NEXT_PUBLIC_GROQ_API_KEY` não é mais usada — apague do `.env`.

## Publicar esta versão (1.3.0)

1. **Revogue as chaves antigas** (estavam expostas): Groq e Gemini. Gere uma chave nova da Groq.
2. **Banco** — rode, nesta ordem, os arquivos de `supabase/migrations/` no SQL Editor do Supabase (ou `supabase db push`).
3. **Secrets das Edge Functions**:
   ```bash
   supabase login
   supabase link --project-ref dtvsxhiwcvhnncbnnxci
   supabase secrets set GROQ_API_KEY=gsk_NOVA_CHAVE
   supabase secrets set NORICA_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```
   Guarde a `NORICA_ENCRYPTION_KEY` num lugar seguro: sem ela, mensagens e Cofre não podem ser lidos.
4. **Deploy das funções**:
   ```bash
   supabase functions deploy norica
   supabase functions deploy norica-transcribe
   ```
5. **App**:
   ```bash
   npm install
   npm run build:mobile
   ```
   Depois gere o AAB assinado no Android Studio (versionCode 42) e envie para a Play Store.
6. **Play Console** — atualize a seção *Segurança dos dados*: dados de saúde/emocionais coletados, criptografados, com opção de exclusão no app; URL de exclusão: `https://SEU-SITE/excluir-conta/`.
7. Troque `CONTACT_EMAIL` em `app/privacidade/page.tsx` pelo e-mail oficial.

## Modelos de IA

A Groq desliga modelos antigos de tempos em tempos (o `llama-3.1-8b-instant` usado até a 1.2.7 foi desligado em 16/08/2026 — por isso a IA parou).
Os modelos agora são escolhidos no servidor e podem ser trocados **sem publicar nova versão do app**:

```bash
supabase secrets set GROQ_CHAT_MODEL=openai/gpt-oss-120b GROQ_FAST_MODEL=openai/gpt-oss-20b
```

Acompanhe: https://console.groq.com/docs/deprecations

## Porto com resposta aparecendo enquanto é escrita

A ação `chat_stream` da função `norica` devolve a resposta aos pedaços (NDJSON: `start` → `delta`… → `done`).
O app lê com o fetch original do WebView (`window.CapacitorWebFetch`), porque o CapacitorHttp espera a resposta inteira.
Se a função publicada ainda for a antiga, o app usa a ação `chat` (resposta inteira) automaticamente.

## Como a Nórica responde (IA)

Tudo em `supabase/functions/_shared/safety.ts` (versão em `PROMPT_VERSION`):
- **4 modos** escolhidos nos botões do começo da conversa: desabafar, organizar, acalmar e um passo. Sem modo, ela pergunta uma vez o que a pessoa precisa.
- **Contexto do app:** humor dos últimos 7 dias, Logs e assuntos recentes entram no prompt (`buildContext`).
- **Memória entre conversas** (`user_memory`, criptografada): atualizada em segundo plano; a pessoa vê, desliga e apaga em Perfil → Memória da Nórica.
- **Risco:** palavras-chave + checagem por IA (`RISK_PROMPT`, modelo rápido, até 2,5s). Risco alto mostra o painel de ajuda e agenda um "como você está?" para o dia seguinte.
- **Plano de segurança** (`/plano-seguranca/`, `safety_plans` criptografada) com pessoas de confiança no botão de ajuda.
- **👍/👎** em cada resposta (`message_feedback`, sem o texto). Para ver: `select * from feedback_resumo;`
- **Ouvir:** leitura em voz pelo próprio celular (`@capacitor-community/text-to-speech`).

### Bateria de conversas de teste

30 situações (luto, prova, briga, crise indireta…) com nota de uma juíza automática:

```powershell
$env:GROQ_API_KEY="gsk_..."; npx tsx supabase/tests/avaliar-ia.mts
```
Rode antes e depois de mudar o prompt ou o modelo e compare as médias. O relatório completo fica em `supabase/tests/relatorios/`.

## Engajamento e parceiros

- **Resumo da semana (Pro):** Farol → Resumo da semana. Ação `weekly_summary` (tabela `weekly_summaries`, criptografada). Notificação aos domingos, 19h.
- **Diário por voz:** Logs → Diário por voz (até 1 minuto, ou escrito). Ação `journal_voice` → resumo, humor e um passo para os Logs (`journal_entries`, criptografada).
- **Exercícios guiados:** `/exercicios/` (hub da Bússola) — aterramento 5-4-3-2-1, três coisas boas e preparar conversa difícil (abre a Arena com o cenário da pessoa).
- **Pessoa de confiança:** botão "Avisar" no S.O.S e no painel de ajuda (vem do plano de segurança).
- **Notificações:** lembrete diário, resumo de domingo, sequência dos Logs e "sentimos sua falta" (3 dias sem abrir). Convite na Início a partir da 2ª visita. Tudo local, configurável em Perfil → Notificações.
- **Widget Android:** "Como está o seu mar?" com 4 humores (`MoodWidget.java`, `res/layout/widget_mood.xml`). Abre o app com `com.zcx.norica://humor/<humor>`, que registra e confirma.
- **Painel B2B:** a pessoa digita o código em Perfil → Instituição Parceira; a equipe (role `admin`) vê `/painel/` com números agregados e anônimos (mínimo de 5 pessoas ativas; temas só com 3+ pessoas). Como cadastrar: veja o fim de `supabase/migrations/20261016180000_norica_engajamento.sql`.

- **Setores / turmas (B2B):** a equipe cria grupos no `/painel/` (Gerenciar setores) e escolhe como chamar: Setor, Turma, Equipe, Departamento ou Unidade. Cada pessoa escolhe o seu em Perfil → Instituição Parceira. O painel mostra cada grupo (humor, % com dia difícil, ansiedade, Logs, assuntos), pontos de atenção (alta de 10+ pontos ou 15+ acima da média), ações sugeridas e exporta CSV. Grupos com menos de 5 pessoas ativas entram em "Outros", e o menor grupo visível vai junto se "Outros" ficar pequeno (ninguém é descoberto por subtração). Tabela `org_sectors` (migration `20261016200000_norica_jornada.sql`).

## Jornada (1.3.0)

- **Começo guiado:** 3 telas depois do consentimento (o que é a Nórica, lembrete diário, pessoa de confiança). `components/Onboarding.tsx`.
- **Conquistas:** Farol → Conquistas, 15 marcos calculados no servidor (ação `achievements`). `components/Conquistas.tsx`.
- **Sons para acalmar:** mar, chuva, ruído branco e marrom gerados no aparelho (Web Audio, sem arquivos, funciona offline), com volume e timer que abaixa devagar. Na Respiração e no Modo noite. `lib/ambient.ts`.
- **Relatório mensal em PDF (Pro):** Farol → Relatório do mês. Ação `monthly_report` (carta da IA guardada criptografada em `monthly_reports`); o PDF é montado no celular (jsPDF) e aberto no menu de compartilhar.
- **Modo noite:** `/noite/` — tela bem escura, respiração 4-6, "esvaziar a mente" (diário do tipo `noite`) e sons com timer de 30 min. Card na Início das 21h às 5h.
- **Relógio (Wear OS):** módulo opcional `android/wear` com Respiração 4-7-8 (vibra a cada fase) e S.O.S (188/192 + aterramento). Para gerar: `norica.wear=true` em `android/gradle.properties` e `gradlew :wear:bundleRelease`; envie no mesmo app do Play Console (faixa Wear OS). O app do celular não muda.

- **Instituições de demonstração:** códigos `DEMOESCOLA` (turmas) e `DEMOEMPRESA` (setores). Quem entra vira equipe e vê o `/painel/` com números fictícios, marcado como "Demonstração" — para apresentar a escolas e empresas. Para sair: Perfil → Instituição Parceira → Sair. (Migration `20261016220000_norica_voz_demo.sql`.)
- **Voz natural (opcional):** com `supabase secrets set GEMINI_API_KEY=...` (chave do Google AI Studio), "Ouvir" usa vozes de IA mais humanas (Perfil → Voz da Nórica). Sem a chave, sem internet ou depois do limite do dia (20 no Gratuito, 120 no Pro), a leitura continua com a voz do celular. Modelo em `GEMINI_TTS_MODEL` (padrão `gemini-3.8-flash-tts`).

## Ferramentas (1.4.0)

- **Widget com pérolas:** além dos 4 humores, "Bebi água", "Respirei" e "Saí de casa" marcam o hábito do dia (`com.zcx.norica://habito/<id>`).
- **Trilhas de 7 dias:** `/trilhas/` — Ansiedade antes da prova, Dormir melhor e Gentileza consigo. Um passo por dia, aviso às 19h, progresso no aparelho (`lib/trilhas.ts`). Card "Trilha de hoje" na Início.
- **Cartas para o futuro:** `/cartas/` — 1 semana a 1 ano. Tabela `future_letters` (criptografada); o servidor só libera o texto na data. Aviso local quando chega e card na Início.
- **Agenda da terapia:** `/terapia/` — próxima consulta (única, semanal ou quinzenal), avisos na véspera e 2h antes, "o que quero levar" com sugestões do diário e "depois da sessão" (diário tipo `terapia`). Fica no aparelho.
- **Campanhas B2B:** no `/painel/`, a equipe publica Setembro Amarelo, Semana de provas, Pausa ativa, Semana do sono ou mensagem livre, com período. Aparece na Início dos participantes (tabela `org_campaigns`).
- **Relatório da instituição em PDF:** botão no `/painel/` com visão geral, evolução de 4 semanas, setores/turmas, alertas, ações e campanhas.
- Migration: `20261017090000_norica_cartas_campanhas.sql`.

## Acolhimento (1.5.0)

- **Check-in da noite:** 21h, "Como foi o seu dia?" com 🙂 Bem / 😐 Mais ou menos / 😣 Difícil direto na notificação (registra o humor; "Difícil" abre o Porto). Depois de um dia difícil, bom-dia gentil às 9h.
- **Roda das emoções:** ao tocar no humor da Início, a pessoa escolhe a palavra exata (coluna `mood_logs.feeling`); a IA conversa usando essa palavra.
- **Pergunta do dia** no Diário por voz (`lib/perguntas.ts`).
- **Caixa de calma** (`/calma/`): frases, fotos, músicas e áudios gravados por quem a pessoa ama — só no aparelho (IndexedDB). Abre primeiro no S.O.S.
- **Acalmar só com toques** (`/toque/`): respirar segurando o círculo ou estourar bolhas. Também no S.O.S.
- **Datas que pesam** (`/datas/`), **mural de vitórias** (`/mural/`) e **mapa do mar** no Farol (ação `patterns`).
- **Foguinho com amigos** (`/amigos/`): duplas de cuidado, chama compartilhada com 1 dia de descanso por semana, apoio/pensei/parabéns; amigo só vê se o outro marcou o dia. Tabelas `care_invites`, `care_pairs`, `care_nudges`. **"Pensei em você"**: cartão para WhatsApp.
- **Chat entre amigos** (`/amigos/chat/?pair=`): só entre duplas do foguinho; texto criptografado (`care_messages`), áudio de apoio de até 30 s no bucket privado `care-audio` (links temporários) que o amigo pode salvar na caixa de calma; risco detectado mostra o CVV 188 para quem escreveu e dicas de acolhimento para o amigo; respostas prontas; apagar conversa; bloquear/denunciar em um toque (`care_blocks`, `care_reports` com trecho criptografado).
- **Foguinho de grupo** (3 a 6 pessoas, `care_groups`/`care_group_members`): a chama acende quando 60% marcam o dia. **Desafios leves em dupla** (`care_challenges`, 7 dias, conferidos pelos hábitos dos Logs). **Amigo sumido** (3+ dias sem marcar → "tá tudo bem?"). **Conquistas do mês** compartilhadas só se cada um ligar (nunca o humor).
- **Push em tempo real (Firebase, opcional):** coloque `android/app/google-services.json` e `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat chave-firebase.json)"`. Sem os dois, nada muda (o app não pede o token). Tokens em `push_tokens`; avisos na tela bloqueada nunca mostram o conteúdo.
- **1.7.0 — instituições pelo app:** qualquer pessoa da direção/RH cria a instituição em Perfil → Instituição Parceira → Criar (`/instituicao/`), com 30 dias de teste (`organizations.plan/trial_until`). Recebe o código para alunos/funcionários e o **código da equipe** (`admin_code`, entra como quem vê o painel). Painel: convite pronto, novo código, renomear, apagar, **calendário de campanhas com um toque** (Janeiro Branco, volta às aulas, provas, sono, Setembro Amarelo, Dia da Saúde Mental, Outubro Rosa, Novembro Azul, fim de ano) e relatório mensal em PDF.
- **Página de vendas** `/empresas/` (pública): demonstração do painel e formulário "agendar conversa" (ação `lead_create`, a única sem login; limite de 5 por hora por IP). Veja os contatos com `select * from leads order by created_at desc;`.
- **Hoje em 1 minuto** (`/hoje/`), **Modo fase difícil** (`/fase/`, só no aparelho; a IA recebe `phase`), **Meditações guiadas** (`/meditacoes/`, textos em `supabase/functions/_shared/meditacoes.ts`; voz natural gerada uma vez por trecho no bucket `meditacoes`) e **widget "Foguinho"** na tela inicial (`FlameWidget.java`).
- **1.8.0 — Caderno de estudos e ideias** (`/caderno/`, na Bússola): anotar por texto ou voz (aprendizado, ideia, lembrete); a IA organiza (título, resumo, matéria, etiquetas) e cria cartões de revisão. **Relembrar** (`/caderno/revisar/`) com repetição espaçada (`_shared/caderno.ts`, `nextReview`), **Estudar com a IA** (`/caderno/estudar/`: explicação, pontos-chave e quiz; dá para guardar no Caderno), **Perguntar ao Caderno** (`/caderno/perguntar/`: responde só com as anotações, citando a origem) e **Foco** (`/caderno/foco/`: 15/25/45 min com som e ansiedade antes/depois). Tabelas `study_notes`, `study_cards`, `study_reviews`, `study_sessions` (texto criptografado). Gratuito: anotar e revisar à vontade + 8 ajudas da IA por dia (`study_ai`); Pro: 150/dia. Migration: `20261022090000_norica_caderno.sql`.
- **1.9.0 — Faculdade** (`/faculdade/`, na Bússola): matérias com cor, professor, sala e horários; **página de cada matéria** estilo Notion (`/faculdade/materia/?id=`: títulos, listas e tarefas marcáveis, modelos prontos, salva sozinha), **a fazer** com prazo, **datas** (prova, trabalho, entrega, apresentação) com nota, peso e **média** ("quanto preciso tirar"), **calendário** mensal (`/faculdade/calendario/`), lembretes na véspera (19h) e no dia (7h), card na Início e atalho para anotar no Caderno com a matéria. Tabelas `courses`, `course_events`, `course_tasks` (RLS, acesso direto do app). Migration: `20261022120000_norica_faculdade.sql`.
- **Pausa de movimento** (`/movimento/`), lembretes opcionais de água, sol e movimento; sons de lareira, floresta e café; **leitura fácil** no Perfil; trilhas novas (quem cuida, pais de primeira viagem, LGBTQIA+) — **revisar o texto das trilhas com o(a) psicólogo(a) responsável antes de divulgar**.
- Pendente: vídeos em Libras (precisam de intérprete).
- Migration: `20261017120000_norica_amigos.sql`.

## Logs e humor sem internet

`lib/offline-sync.ts`: o que a pessoa marca vai primeiro para uma fila no aparelho e é enviado ao Supabase
ao abrir o app, ao voltar para ele e quando a internet volta. Os Logs mostram "Salvo no aparelho" enquanto houver pendência.

## Lembrete diário

Notificação local (`@capacitor/local-notifications`), configurada em **Perfil → Lembrete Diário**.
Uma mensagem por dia da semana, no horário escolhido. Ícone: `android/app/src/main/res/drawable/ic_stat_norica.xml`.

## Erros e lentidão

O app registra sozinho erros inesperados e lentidão (abertura > 4s, primeira palavra do Porto > 8s) na tabela `app_errors`
(migration `20261016120000_norica_erros.sql`). Ninguém do app consegue ler a tabela. Para ver:

```sql
select * from app_errors_resumo;   -- últimos 30 dias, agrupado
```

## Verificar se tudo funciona

No app: **Perfil → Verificar sistema** (rodapé). Testa banco, criptografia e os dois modelos de IA.

## Planos e assinatura Pro (R$ 15,00/mês)

- **Gratuito:** 30 mensagens/dia no Porto, 2 retornos/dia na Arena, Farol de 7 dias. S.O.S, Ajuda, Respiração, Logs e Cofre sem limite.
- **Pro:** Porto e Arena sem limite diário (uso justo), Farol de 30 dias. Em breve: relatório mensal em PDF e novos cenários.
- **Modo lançamento:** enquanto o secret `NORICA_LAUNCH_ALL_PRO` não for `false`, todos usam o Pro de graça e o botão mostra "Me avise quando abrir".

### Ligar a cobrança pela Google Play

1. **Play Console → Monetizar → Produtos → Assinaturas → Criar assinatura**
   - ID do produto: `norica_pro_mensal`
   - Plano básico: mensal, renovação automática, preço **R$ 15,00**. Ative o plano básico.
2. **Google Cloud** (mesmo projeto ligado ao Play Console): ative a *Google Play Android Developer API* e crie uma **conta de serviço** com chave JSON.
3. **Play Console → Usuários e permissões → Convidar** o e-mail da conta de serviço, com permissão de *Ver dados financeiros* e *Gerenciar pedidos e assinaturas* para o app.
4. **Secrets**:
   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat conta-de-servico.json)"
   supabase functions deploy norica
   ```
5. Publique a nova versão (o plugin de compras adiciona a permissão de cobrança): `npm install && npm run build:mobile`.
6. Teste com uma conta em **Play Console → Configuração → Teste de licença** (compras de teste não são cobradas).
7. Quando estiver tudo certo, ligue a cobrança: `supabase secrets set NORICA_LAUNCH_ALL_PRO=false`.

Como funciona: a pessoa assina na Google Play → o app envia o token da compra → a função `norica` confere com o Google (inclusive se a compra é da mesma conta) e só então libera o Pro → o app confirma a compra. Renovações e cancelamentos são conferidos com o Google quando o período pago termina.

Para dar Pro manualmente (parceiro, piloto), veja o comentário no fim de `supabase/migrations/20261015170000_norica_planos.sql`.

## Manter o Supabase ativo

O workflow `.github/workflows/supabase-keepalive.yml` faz uma consulta a cada 2 dias.
Crie o secret `SUPABASE_ANON_KEY` em *Settings → Secrets and variables → Actions* e rode uma vez manualmente em *Actions*.

## Segurança

- Nunca versione keystores (`*.jks`, `*.keystore`, `aab/`) nem `.env` — já estão no `.gitignore`.
- O keystore `aab/zcx` ficou no histórico público do repositório. Se for a chave de upload da Play Store, peça o reset da chave de upload no Play Console.
