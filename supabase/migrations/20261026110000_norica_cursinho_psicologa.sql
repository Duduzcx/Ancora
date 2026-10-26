-- =====================================================================
-- Nórica 2.1.0 — Cursinho (ENEM/ETEC) e acompanhamento pela psicóloga (com consentimento)
-- Rode no SQL Editor do Supabase depois de 20261026100000_norica_plano_estudos.sql. Idempotente.
-- =====================================================================

-- 1. Tipo "cursinho" (pré-vestibular, ENEM, ETEC)
alter table public.organizations drop constraint if exists organizations_kind_check;
alter table public.organizations add constraint organizations_kind_check check (kind in ('escola', 'empresa', 'cursinho', 'outro'));
alter table public.leads drop constraint if exists leads_kind_check;
alter table public.leads add constraint leads_kind_check check (kind in ('escola', 'empresa', 'cursinho', 'outro'));

-- 2. Campanhas para época de vestibular
alter table public.org_campaigns drop constraint if exists org_campaigns_kind_check;
alter table public.org_campaigns add constraint org_campaigns_kind_check check (kind in (
  'setembro', 'provas', 'pausa', 'sono', 'livre',
  'janeiro', 'voltaaulas', 'saudemental', 'fimdeano', 'outubrorosa', 'novembroazul', 'ansiedade',
  'enem', 'vesperaenem', 'etec', 'simulado', 'resultado'
));

-- 3. Acompanhamento pela psicóloga
--    Só aparece quem LIGOU "compartilhar com a psicóloga" (e pode desligar quando quiser).
--    A psicóloga vê só o humor dos últimos dias e alertas — nunca conversas, diário ou Cofre.
alter table public.organizations add column if not exists psi_enabled boolean not null default false;
alter table public.organizations add column if not exists psi_guardian_ok boolean not null default false;  -- instituição confirmou autorização dos responsáveis
alter table public.organizations add column if not exists psi_code text;
alter table public.organizations drop constraint if exists organizations_psi_code_check;
alter table public.organizations add constraint organizations_psi_code_check check (psi_code is null or psi_code ~ '^[A-Z0-9]{4,12}$');
create unique index if not exists organizations_psi_code_key on public.organizations (psi_code) where psi_code is not null;

alter table public.org_members add column if not exists is_psi boolean not null default false;
alter table public.org_members add column if not exists share_psi boolean not null default false;
alter table public.org_members add column if not exists share_psi_at timestamptz;
alter table public.org_members add column if not exists last_alert_at timestamptz;

-- Registro de cada vez que a psicóloga abre a lista (transparência e auditoria).
create table if not exists public.org_care_access (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  psi_user    uuid not null references auth.users(id) on delete cascade,
  viewed      int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists org_care_access_org_idx on public.org_care_access (org_id, created_at desc);
alter table public.org_care_access enable row level security;
revoke all on public.org_care_access from anon, authenticated;   -- só o servidor
