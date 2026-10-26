-- =====================================================================
-- Nórica 2.0.0 — Plano de estudos com IA e vídeos
-- Rode no SQL Editor do Supabase depois de 20261026090000_norica_caderno_rapido.sql. Idempotente.
-- =====================================================================

-- 1. Planos de estudo (o conteúdo do plano fica criptografado pelo servidor)
create table if not exists public.study_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content         text not null,                      -- criptografado (JSON com objetivo, dias, dicas)
  total_days      int  not null check (total_days between 1 and 60),
  done_days       int[] not null default '{}',
  starts_on       date not null default current_date,
  deadline        date,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists study_plans_user_idx on public.study_plans (user_id, archived, created_at desc);

alter table public.study_plans enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'study_plans' and policyname = 'study_plans_own') then
    create policy study_plans_own on public.study_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
revoke all on public.study_plans from anon;

-- 2. Vídeos do YouTube já buscados (por termo de busca; não tem nada pessoal).
--    Evita gastar a cota diária da API buscando o mesmo assunto de novo.
create table if not exists public.video_cache (
  query       text primary key check (char_length(query) <= 200),
  results     jsonb not null default '[]'::jsonb,
  fetched_at  timestamptz not null default now()
);
alter table public.video_cache enable row level security;
revoke all on public.video_cache from anon, authenticated;   -- só o servidor lê e grava
