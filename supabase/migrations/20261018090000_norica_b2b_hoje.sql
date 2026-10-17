-- =====================================================================
-- Nórica 1.7.0 — instituições criadas pelo próprio app, contatos da página de vendas,
-- campanhas prontas, "Hoje em 1 minuto" e áudios das meditações guiadas.
-- Rode no SQL Editor do Supabase depois de 20261017150000_norica_social.sql.
-- =====================================================================

-- 1. Instituições: tipo, código da equipe, período de teste e quem criou
alter table public.organizations add column if not exists kind text not null default 'empresa';
alter table public.organizations drop constraint if exists organizations_kind_check;
alter table public.organizations add constraint organizations_kind_check check (kind in ('escola', 'empresa', 'outro'));
alter table public.organizations add column if not exists admin_code text;
alter table public.organizations drop constraint if exists organizations_admin_code_check;
alter table public.organizations add constraint organizations_admin_code_check check (admin_code is null or admin_code ~ '^[A-Z0-9]{4,12}$');
create unique index if not exists organizations_admin_code_key on public.organizations (admin_code) where admin_code is not null;
alter table public.organizations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists plan text not null default 'teste';
alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations add constraint organizations_plan_check check (plan in ('teste', 'ativo', 'pausado'));
alter table public.organizations add column if not exists trial_until date;
alter table public.organizations add column if not exists seats integer;

-- As demonstrações continuam como estão
update public.organizations set kind = 'escola' where code = 'DEMOESCOLA';

-- 2. Campanhas prontas (calendário do ano)
alter table public.org_campaigns drop constraint if exists org_campaigns_kind_check;
alter table public.org_campaigns add constraint org_campaigns_kind_check check (kind in (
  'setembro', 'provas', 'pausa', 'sono', 'livre',
  'janeiro', 'voltaaulas', 'saudemental', 'fimdeano', 'outubrorosa', 'novembroazul', 'ansiedade'
));

-- 3. Contatos da página "Para escolas e empresas" (agendar conversa)
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  org_name    text not null check (char_length(org_name) between 2 and 120),
  kind        text not null check (kind in ('escola', 'empresa', 'outro')),
  size        text,
  phone       text,
  email       text,
  message     text check (message is null or char_length(message) <= 600),
  ip_hash     text,
  status      text not null default 'novo' check (status in ('novo', 'conversando', 'fechado', 'perdido')),
  created_at  timestamptz not null default now()
);
create index if not exists leads_created_idx on public.leads (created_at desc);
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;

-- 4. "Hoje em 1 minuto" salva uma frase no diário
alter table public.journal_entries drop constraint if exists journal_entries_kind_check;
alter table public.journal_entries add constraint journal_entries_kind_check
  check (kind in ('voz', 'gratidao', 'conversa', 'aterramento', 'noite', 'terapia', 'hoje'));

-- 5. Áudios das meditações guiadas (gerados uma vez com a voz natural e reaproveitados)
insert into storage.buckets (id, name, public, file_size_limit)
values ('meditacoes', 'meditacoes', false, 5242880)
on conflict (id) do nothing;

-- Para ver os contatos da página de vendas:
--   select created_at, name, org_name, kind, size, phone, email, message from public.leads order by created_at desc;
