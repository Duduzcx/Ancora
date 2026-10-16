-- =====================================================================
-- Nórica — roda das emoções e foguinho com amigos (1.5.0)
-- Rode no SQL Editor do Supabase depois de 20261017090000_norica_cartas_campanhas.sql.
-- =====================================================================

-- 1. Roda das emoções: a palavra que a pessoa escolheu para o que sente
alter table public.mood_logs add column if not exists feeling text check (feeling is null or char_length(feeling) <= 40);

-- 2. Foguinho com amigos (duplas de cuidado). Só o servidor lê e grava:
--    cada pessoa vê apenas se o amigo marcou o dia e o tamanho da chama, nunca o conteúdo.
create table if not exists public.care_invites (
  code        text primary key check (code ~ '^[A-Z0-9]{6}$'),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.care_pairs (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references auth.users(id) on delete cascade,
  user_b      uuid not null references auth.users(id) on delete cascade,
  name_a      text,
  name_b      text,
  created_at  timestamptz not null default now(),
  check (user_a <> user_b)
);
create unique index if not exists care_pairs_unique on public.care_pairs (least(user_a, user_b), greatest(user_a, user_b));
create index if not exists care_pairs_a on public.care_pairs (user_a);
create index if not exists care_pairs_b on public.care_pairs (user_b);

create table if not exists public.care_nudges (
  id          uuid primary key default gen_random_uuid(),
  pair_id     uuid not null references public.care_pairs(id) on delete cascade,
  from_user   uuid not null references auth.users(id) on delete cascade,
  to_user     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('apoio', 'pensei', 'parabens')),
  seen_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists care_nudges_to on public.care_nudges (to_user, seen_at);

alter table public.care_invites enable row level security;
alter table public.care_pairs enable row level security;
alter table public.care_nudges enable row level security;
revoke all on public.care_invites, public.care_pairs, public.care_nudges from anon, authenticated;
