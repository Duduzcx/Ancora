-- =====================================================================
-- Nórica — IA mais acolhedora (1.3.0)
-- Rode no SQL Editor do Supabase depois das migrations anteriores.
--
-- 1. chats.mode          → o que a pessoa precisa na conversa (desabafar, organizar, acalmar, passo)
-- 2. user_memory         → memória entre conversas (criptografada; a pessoa vê, desliga e apaga no Perfil)
-- 3. safety_plans        → plano de segurança + pessoas de confiança (criptografado)
-- 4. message_feedback    → 👍/👎 nas respostas (sem guardar o texto da conversa)
-- =====================================================================

-- 1. Modo da conversa ---------------------------------------------------
alter table public.chats add column if not exists mode text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chats_mode_check') then
    alter table public.chats add constraint chats_mode_check
      check (mode is null or mode in ('desabafar', 'organizar', 'acalmar', 'passo'));
  end if;
end $$;

-- 2. Memória entre conversas -------------------------------------------
create table if not exists public.user_memory (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  content     text not null default '',          -- criptografado pelo servidor (enc:v1:...)
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- 3. Plano de segurança -------------------------------------------------
create table if not exists public.safety_plans (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  content     text not null,                     -- JSON criptografado pelo servidor
  updated_at  timestamptz not null default now()
);

alter table public.user_memory  enable row level security;
alter table public.safety_plans enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['user_memory', 'safety_plans'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t
      );
    end if;
  end loop;
end $$;
revoke all on public.user_memory, public.safety_plans from anon;

-- 4. Avaliação das respostas (👍/👎) -------------------------------------
create table if not exists public.message_feedback (
  id              bigint generated always as identity primary key,
  message_id      uuid not null references public.messages(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating          smallint not null check (rating in (-1, 1)),
  reason          text check (char_length(reason) <= 60),
  mode            text check (char_length(mode) <= 20),
  prompt_version  text check (char_length(prompt_version) <= 20),
  created_at      timestamptz not null default now(),
  unique (message_id, user_id)
);
create index if not exists message_feedback_created_idx on public.message_feedback (created_at desc);

alter table public.message_feedback enable row level security;
drop policy if exists message_feedback_own on public.message_feedback;
create policy message_feedback_own on public.message_feedback
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke all on public.message_feedback from anon;

-- Resumo para a equipe (só pelo painel/SQL; o app não lê):
--   select * from feedback_resumo;
create or replace view public.feedback_resumo
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date                          as dia,
  coalesce(prompt_version, '-')                                as versao_prompt,
  coalesce(mode, 'sem modo')                                   as modo,
  count(*) filter (where rating = 1)                           as gostei,
  count(*) filter (where rating = -1)                          as nao_gostei,
  round(100.0 * count(*) filter (where rating = 1) / count(*)) as pct_gostei,
  string_agg(distinct reason, ', ') filter (where reason is not null) as motivos
from public.message_feedback
group by 1, 2, 3
order by 1 desc, 2, 3;

revoke all on public.feedback_resumo from anon, authenticated;
