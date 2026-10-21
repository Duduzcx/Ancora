-- =====================================================================
-- Nórica — Caderno (estudos e ideias) · 1.8.0
-- Rode no SQL Editor do Supabase depois de 20261021120000_norica_codigos_pro.sql. Idempotente.
--
-- Anotações, cartões de revisão e sessões de foco. O texto das anotações e dos cartões
-- é criptografado pelo servidor (igual ao diário): no banco fica ilegível.
-- =====================================================================

-- 1. Anotações (aprendizados, ideias e lembretes)
create table if not exists public.study_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null default 'aprendizado' check (kind in ('aprendizado', 'ideia', 'lembrete')),
  title       text not null,           -- criptografado
  content     text not null,           -- criptografado
  summary     text,                    -- criptografado
  subject     text,                    -- criptografado (matéria / assunto)
  tags        text,                    -- criptografado (lista em JSON)
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists study_notes_user_created_idx on public.study_notes (user_id, created_at desc);

-- 2. Cartões de revisão (repetição espaçada: o que a pessoa erra volta logo, o que acerta volta mais tarde)
create table if not exists public.study_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id        uuid references public.study_notes(id) on delete cascade,
  front          text not null,        -- criptografado (pergunta)
  back           text not null,        -- criptografado (resposta)
  ease           real not null default 2.5 check (ease between 1.3 and 3.0),
  interval_days  int  not null default 0 check (interval_days between 0 and 3650),
  reps           int  not null default 0,
  lapses         int  not null default 0,
  due_on         date not null default current_date,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists study_cards_user_due_idx on public.study_cards (user_id, due_on);
create index if not exists study_cards_note_idx on public.study_cards (note_id);

-- 3. Revisões feitas (para a sequência de dias e as conquistas)
create table if not exists public.study_reviews (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id      uuid references public.study_cards(id) on delete set null,
  grade        text not null check (grade in ('errei', 'dificil', 'facil')),
  created_at   timestamptz not null default now()
);
create index if not exists study_reviews_user_created_idx on public.study_reviews (user_id, created_at desc);

-- 4. Sessões de foco (Pomodoro com check-in de ansiedade antes e depois)
create table if not exists public.study_sessions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  minutes       int  not null check (minutes between 1 and 180),
  anxiety_before smallint check (anxiety_before between 1 and 5),
  anxiety_after  smallint check (anxiety_after between 1 and 5),
  created_at    timestamptz not null default now()
);
create index if not exists study_sessions_user_created_idx on public.study_sessions (user_id, created_at desc);

-- Cada pessoa só vê e mexe no que é dela.
alter table public.study_notes    enable row level security;
alter table public.study_cards    enable row level security;
alter table public.study_reviews  enable row level security;
alter table public.study_sessions enable row level security;
do $$
declare
  t text;
begin
  foreach t in array array['study_notes', 'study_cards', 'study_reviews', 'study_sessions'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t
      );
    end if;
  end loop;
end $$;
revoke all on public.study_notes, public.study_cards, public.study_reviews, public.study_sessions from anon;

-- Ações de IA do Caderno contam no limite diário do plano Gratuito.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('porto_message', 'arena_feedback', 'tts', 'promo_try', 'study_ai'));
