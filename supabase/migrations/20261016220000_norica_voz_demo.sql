-- =====================================================================
-- Nórica — voz natural e instituições de demonstração (1.3.1)
-- Rode no SQL Editor do Supabase depois de 20261016200000_norica_jornada.sql.
-- =====================================================================

-- 1. Voz natural: conta o uso diário (limite justo por pessoa)
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('porto_message', 'arena_feedback', 'tts'));

-- 2. Instituições de demonstração: quem entra com o código vira "equipe"
--    e vê o painel com números fictícios (para apresentar a escolas e empresas).
alter table public.organizations add column if not exists demo boolean not null default false;

insert into public.organizations (name, code, sector_label, demo)
values
  ('Escola Demonstração', 'DEMOESCOLA', 'Turma', true),
  ('Empresa Demonstração', 'DEMOEMPRESA', 'Setor', true)
on conflict (code) do update set demo = true, sector_label = excluded.sector_label, name = excluded.name;

insert into public.org_sectors (org_id, name)
select o.id, s.name
from public.organizations o
join (values
  ('DEMOESCOLA', '3º ano A'), ('DEMOESCOLA', '1º ano B'), ('DEMOESCOLA', '2º ano A'), ('DEMOESCOLA', 'Cursinho'),
  ('DEMOEMPRESA', 'Vendas'), ('DEMOEMPRESA', 'RH'), ('DEMOEMPRESA', 'Tecnologia'), ('DEMOEMPRESA', 'Operações')
) as s(code, name) on s.code = o.code
on conflict (org_id, name) do nothing;
