-- =====================================================================
-- Nórica 1.9.2 — Caderno mais rápido
-- Rode no SQL Editor do Supabase depois de 20261022120000_norica_faculdade.sql. Idempotente.
-- A anotação é salva na hora e a IA organiza logo depois; esta coluna guarda o andamento.
-- =====================================================================
alter table public.study_notes add column if not exists ai_state text;
alter table public.study_notes drop constraint if exists study_notes_ai_state_check;
alter table public.study_notes add constraint study_notes_ai_state_check
  check (ai_state is null or ai_state in ('pendente', 'ok', 'erro', 'limite'));
