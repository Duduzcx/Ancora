-- =====================================================================
-- Nórica — resumo semanal, diário por voz, exercícios e painel de parceiros (1.3.0)
-- Rode no SQL Editor do Supabase depois das migrations anteriores.
-- =====================================================================

-- 1. Resumo semanal (gerado pela IA uma vez por semana, criptografado) ----
create table if not exists public.weekly_summaries (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start  date not null,                       -- segunda-feira da semana resumida
  content     text not null,                       -- criptografado pelo servidor
  created_at  timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- 2. Diário (voz, gratidão, preparação de conversa) ----------------------
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('voz', 'gratidao', 'conversa', 'aterramento')),
  content     text not null,                       -- criptografado pelo servidor
  summary     text,                                -- criptografado pelo servidor
  mood        text check (mood is null or mood in ('calmo', 'ansioso', 'agitado', 'sos')),
  created_at  timestamptz not null default now()
);
create index if not exists journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);

alter table public.weekly_summaries enable row level security;
alter table public.journal_entries  enable row level security;
do $$
declare
  t text;
begin
  foreach t in array array['weekly_summaries', 'journal_entries'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t
      );
    end if;
  end loop;
end $$;
revoke all on public.weekly_summaries, public.journal_entries from anon;

-- 3. Parceiros (B2B): instituições e participantes -----------------------
-- O painel mostra SÓ números agregados e anônimos, e só quando há pelo menos
-- 5 pessoas com registros no período. Nenhuma conversa, Cofre ou diário é lido.
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) <= 80),
  code        text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),  -- código que a pessoa digita no app
  created_at  timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'admin')),
  joined_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members (user_id);

alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;
-- Tudo passa pela função "norica" (service role): o app não lê nem altera estas tabelas direto.
revoke all on public.organizations, public.org_members from anon, authenticated;

-- ---------------------------------------------------------------------
-- Como cadastrar um parceiro (ex.: cursinho Compromisso):
--
--   insert into public.organizations (name, code) values ('Cursinho Compromisso', 'COMPROMISSO');
--
-- Os alunos digitam o código em Perfil → Instituição parceira.
-- Para dar acesso ao painel a uma pessoa da equipe (que já tem conta no app):
--
--   insert into public.org_members (org_id, user_id, role)
--   select o.id, u.id, 'admin' from public.organizations o, auth.users u
--   where o.code = 'COMPROMISSO' and u.email = 'coordenacao@compromissose.com'
--   on conflict (org_id, user_id) do update set role = 'admin';
--
-- A pessoa admin vê o painel em Perfil → Painel da instituição.
-- ---------------------------------------------------------------------
