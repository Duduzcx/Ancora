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
