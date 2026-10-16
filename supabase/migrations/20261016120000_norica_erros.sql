-- =====================================================================
-- Nórica — registro de erros e lentidão do app (1.3.0)
-- Rode no SQL Editor do Supabase depois das migrations anteriores.
--
-- O app envia aqui, sozinho, os erros que acontecem nos celulares das pessoas
-- e os momentos de lentidão (abertura demorada, resposta do Porto lenta).
-- Ninguém do app consegue LER esta tabela: só a equipe, pelo painel do Supabase.
-- Não guarda conteúdo de conversa — só a mensagem técnica do erro e a tela.
-- =====================================================================

create table if not exists public.app_errors (
  id           bigint generated always as identity primary key,
  user_id      uuid default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null default 'error' check (kind in ('error', 'slow')),
  message      text not null check (char_length(message) <= 500),
  stack        text check (char_length(stack) <= 4000),
  page         text check (char_length(page) <= 200),
  app_version  text check (char_length(app_version) <= 40),
  device       text check (char_length(device) <= 300),
  duration_ms  integer,
  created_at   timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);

alter table public.app_errors enable row level security;

-- Qualquer um pode ENVIAR (inclusive antes do login), mas só em nome próprio.
drop policy if exists app_errors_insert on public.app_errors;
create policy app_errors_insert on public.app_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke select, update, delete on public.app_errors from anon, authenticated;
grant insert on public.app_errors to anon, authenticated;

-- Resumo para a equipe (Table Editor → app_errors_resumo, ou SQL: select * from app_errors_resumo;)
create or replace view public.app_errors_resumo
with (security_invoker = true) as
select
  kind                       as tipo,
  message                    as erro,
  page                       as tela,
  count(*)                   as vezes,
  count(distinct user_id)    as pessoas,
  round(avg(duration_ms))    as media_ms,
  max(created_at)            as ultima_vez
from public.app_errors
where created_at > now() - interval '30 days'
group by kind, message, page
order by vezes desc;

revoke all on public.app_errors_resumo from anon, authenticated;

-- Limpeza: registros com mais de 90 dias podem ser apagados com
--   delete from public.app_errors where created_at < now() - interval '90 days';
