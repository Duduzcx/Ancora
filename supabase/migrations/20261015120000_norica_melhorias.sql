-- =====================================================================
-- Nórica — melhorias de outubro/2026
-- Rodar uma vez no SQL Editor do Supabase (ou `supabase db push`).
-- É idempotente: pode rodar de novo sem quebrar nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Registro de humor (mapa emocional + Farol)
-- ---------------------------------------------------------------------
create table if not exists public.mood_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mood        text not null check (mood in ('calmo', 'ansioso', 'agitado', 'sos')),
  created_at  timestamptz not null default now()
);
create index if not exists mood_logs_user_created_idx on public.mood_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2a. Hábitos da aba Logs sincronizados (+ tarefas sugeridas pela IA)
-- ---------------------------------------------------------------------
create table if not exists public.habit_logs (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day           date not null,
  completed     integer[] not null default '{}',
  custom_tasks  jsonb not null default '[]'::jsonb,
  progress      numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------
-- 2b. Resumo emocional do dia gerado pela IA a partir do Porto (lido pelo Farol).
--     Já usado pelo app; criado aqui caso ainda não exista.
-- ---------------------------------------------------------------------
create table if not exists public.daily_logs (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date      date not null,
  humor     text,
  assunto   text,
  conselho  text,
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------
-- 3. Cofre (conteúdo criptografado pela Edge Function)
-- ---------------------------------------------------------------------
create table if not exists public.vault_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists vault_entries_user_created_idx on public.vault_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. Consentimento LGPD (dados sensíveis)
-- ---------------------------------------------------------------------
create table if not exists public.consents (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  version      text not null,
  accepted_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. RLS: cada usuário só enxerga e altera o que é dele
-- ---------------------------------------------------------------------
alter table public.mood_logs     enable row level security;
alter table public.habit_logs    enable row level security;
alter table public.daily_logs    enable row level security;
alter table public.vault_entries enable row level security;
alter table public.consents      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['mood_logs', 'habit_logs', 'daily_logs', 'vault_entries', 'consents'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t
      );
    end if;
  end loop;
end $$;

-- Tabelas que já existiam: garante RLS ligado e políticas de dono.
-- (Se já houver políticas próprias, estas apenas se somam a elas.)
alter table public.profiles enable row level security;
alter table public.chats    enable row level security;
alter table public.messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_own') then
    create policy profiles_own on public.profiles for all to authenticated
      using (id = auth.uid()) with check (id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chats' and policyname = 'chats_own') then
    create policy chats_own on public.chats for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_own') then
    create policy messages_own on public.messages for all to authenticated
      using (exists (select 1 from public.chats c where c.id = messages.chat_id and c.user_id = auth.uid()))
      with check (exists (select 1 from public.chats c where c.id = messages.chat_id and c.user_id = auth.uid()));
  end if;
end $$;

-- Ninguém sem login lê nada.
revoke all on public.mood_logs, public.habit_logs, public.daily_logs, public.vault_entries, public.consents from anon;
