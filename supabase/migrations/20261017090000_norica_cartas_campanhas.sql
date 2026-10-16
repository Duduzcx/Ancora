-- =====================================================================
-- Nórica — cartas para o futuro, anotações da terapia e campanhas (1.4.0)
-- Rode no SQL Editor do Supabase depois de 20261016220000_norica_voz_demo.sql.
-- =====================================================================

-- 1. Diário: novo tipo "terapia" (o que ficou da sessão)
alter table public.journal_entries drop constraint if exists journal_entries_kind_check;
alter table public.journal_entries add constraint journal_entries_kind_check
  check (kind in ('voz', 'gratidao', 'conversa', 'aterramento', 'noite', 'terapia'));

-- 2. Cartas para o futuro: a pessoa escreve hoje e só consegue ler na data escolhida
create table if not exists public.future_letters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content     text not null,                 -- criptografado pelo servidor
  deliver_at  timestamptz not null,
  opened_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists future_letters_user_idx on public.future_letters (user_id, deliver_at);
alter table public.future_letters enable row level security;
-- Só o servidor lê e grava (para a carta não poder ser aberta antes da hora).
revoke all on public.future_letters from anon, authenticated;

-- 3. Campanhas das instituições parceiras (Setembro Amarelo, semana de provas…)
create table if not exists public.org_campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null check (kind in ('setembro', 'provas', 'pausa', 'sono', 'livre')),
  title       text not null check (char_length(title) between 1 and 60),
  message     text not null check (char_length(message) between 1 and 280),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists org_campaigns_org_idx on public.org_campaigns (org_id, ends_on);
alter table public.org_campaigns enable row level security;
revoke all on public.org_campaigns from anon, authenticated;
