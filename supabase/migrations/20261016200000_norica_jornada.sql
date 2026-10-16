-- =====================================================================
-- Nórica — modo noite, relatório mensal e setores dos parceiros (1.3.0)
-- Rode no SQL Editor do Supabase depois das migrations anteriores.
-- =====================================================================

-- 1. Diário: novo tipo "noite" (Modo noite → esvaziar a mente) ---------------
alter table public.journal_entries drop constraint if exists journal_entries_kind_check;
alter table public.journal_entries add constraint journal_entries_kind_check
  check (kind in ('voz', 'gratidao', 'conversa', 'aterramento', 'noite'));

-- 2. Relatório mensal (Pro): texto da IA guardado para não gerar de novo -----
create table if not exists public.monthly_reports (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month       date not null,                    -- primeiro dia do mês
  content     text not null,                    -- criptografado pelo servidor
  created_at  timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.monthly_reports enable row level security;
drop policy if exists monthly_reports_own on public.monthly_reports;
create policy monthly_reports_own on public.monthly_reports
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.monthly_reports from anon;

-- 3. Setores / turmas dentro de cada instituição parceira -------------------
create table if not exists public.org_sectors (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);
alter table public.org_members add column if not exists sector_id uuid references public.org_sectors(id) on delete set null;
-- Como a instituição chama os grupos: "Setor" (empresa) ou "Turma" (escola).
alter table public.organizations add column if not exists sector_label text not null default 'Setor';

alter table public.org_sectors enable row level security;
revoke all on public.org_sectors from anon, authenticated;

-- ---------------------------------------------------------------------
-- Exemplo (empresa):
--   insert into public.org_sectors (org_id, name)
--   select id, s from public.organizations, unnest(array['Vendas','RH','Tecnologia','Operações']) as s
--   where code = 'MINHAEMPRESA';
-- Exemplo (escola): update public.organizations set sector_label = 'Turma' where code = 'COMPROMISSO';
-- Os setores também podem ser criados pela equipe no próprio painel do app.
-- ---------------------------------------------------------------------
