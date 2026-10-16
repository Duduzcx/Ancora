-- =====================================================================
-- Nórica — chat entre amigos, foguinho de grupo, desafios e push (1.6.0)
-- Rode no SQL Editor do Supabase depois de 20261017120000_norica_amigos.sql.
-- Todas as tabelas são lidas e gravadas SÓ pelo servidor (função norica).
-- =====================================================================

-- 1. Duplas: quando cada um leu a conversa e se quer mostrar suas conquistas ao outro
alter table public.care_pairs add column if not exists read_a timestamptz;
alter table public.care_pairs add column if not exists read_b timestamptz;
alter table public.care_pairs add column if not exists share_a boolean not null default false;
alter table public.care_pairs add column if not exists share_b boolean not null default false;

-- 2. Chat entre amigos (texto criptografado; áudio no Storage privado)
create table if not exists public.care_messages (
  id          uuid primary key default gen_random_uuid(),
  pair_id     uuid not null references public.care_pairs(id) on delete cascade,
  from_user   uuid not null references auth.users(id) on delete cascade,
  kind        text not null default 'texto' check (kind in ('texto', 'audio')),
  content     text,                 -- criptografado pelo servidor (texto)
  audio_path  text,                 -- caminho no bucket care-audio
  risk        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists care_messages_pair on public.care_messages (pair_id, created_at desc);

-- 3. Bloqueios e denúncias
create table if not exists public.care_blocks (
  blocker     uuid not null references auth.users(id) on delete cascade,
  blocked     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker, blocked)
);
create table if not exists public.care_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null references auth.users(id) on delete cascade,
  reported    uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (char_length(reason) <= 300),
  excerpt     text,                 -- últimas mensagens, criptografadas, para a equipe analisar
  created_at  timestamptz not null default now()
);

-- 4. Foguinho de grupo (3 a 6 pessoas)
create table if not exists public.care_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create table if not exists public.care_group_members (
  group_id    uuid not null references public.care_groups(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text,
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 5. Desafios em dupla (7 dias, conferidos pelos Logs de cada um)
create table if not exists public.care_challenges (
  id          uuid primary key default gen_random_uuid(),
  pair_id     uuid not null references public.care_pairs(id) on delete cascade,
  kind        text not null check (kind in ('agua', 'caminhar', 'respirar', 'telas', 'gratidao', 'alongar')),
  days        integer not null default 7 check (days between 3 and 30),
  start_day   date not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists care_challenges_pair on public.care_challenges (pair_id, start_day desc);

-- 6. Notificações push (Firebase): o aparelho de cada pessoa
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null default 'android',
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);

-- Mensagens de apoio também podem ser áudio
alter table public.care_nudges drop constraint if exists care_nudges_kind_check;
alter table public.care_nudges add constraint care_nudges_kind_check check (kind in ('apoio', 'pensei', 'parabens', 'sumido'));

alter table public.care_messages enable row level security;
alter table public.care_blocks enable row level security;
alter table public.care_reports enable row level security;
alter table public.care_groups enable row level security;
alter table public.care_group_members enable row level security;
alter table public.care_challenges enable row level security;
alter table public.push_tokens enable row level security;
revoke all on public.care_messages, public.care_blocks, public.care_reports, public.care_groups,
  public.care_group_members, public.care_challenges, public.push_tokens from anon, authenticated;

-- 7. Bucket privado para os áudios de apoio (só o servidor acessa, com links temporários)
insert into storage.buckets (id, name, public, file_size_limit)
values ('care-audio', 'care-audio', false, 1048576)
on conflict (id) do nothing;
