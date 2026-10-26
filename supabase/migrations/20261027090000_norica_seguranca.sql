-- =====================================================================
-- Nórica 2.1.1 — Reforço de segurança (auditoria de 27/10/2026)
-- Rode no SQL Editor do Supabase depois de 20261026110000_norica_cursinho_psicologa.sql. Idempotente.
-- =====================================================================

-- 1. Limites de uso e de tentativas (o servidor registra cada uso nesta tabela).
--    Sem estes tipos, o banco recusava o registro e os limites da IA e dos códigos não valiam.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in (
    'porto_message', 'arena_feedback', 'tts', 'promo_try', 'study_ai',
    'ai_misc', 'transcribe', 'org_try', 'friend_try', 'health', 'youtube'
  ));

-- 2. Cartões e revisões só podem apontar para anotações/cartões da própria pessoa.
drop trigger if exists study_cards_owner on public.study_cards;
drop trigger if exists study_reviews_owner on public.study_reviews;
drop function if exists public.study_child_owner_check();

create or replace function public.study_card_owner_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.note_id is not null
     and not exists (select 1 from public.study_notes n where n.id = new.note_id and n.user_id = new.user_id) then
    raise exception 'anotação inválida';
  end if;
  return new;
end $$;

create or replace function public.study_review_owner_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.card_id is not null
     and not exists (select 1 from public.study_cards c where c.id = new.card_id and c.user_id = new.user_id) then
    raise exception 'cartão inválido';
  end if;
  return new;
end $$;
revoke all on function public.study_card_owner_check() from public, anon, authenticated;
revoke all on function public.study_review_owner_check() from public, anon, authenticated;

create trigger study_cards_owner before insert or update on public.study_cards
  for each row execute function public.study_card_owner_check();
create trigger study_reviews_owner before insert or update on public.study_reviews
  for each row execute function public.study_review_owner_check();

-- 3. 👍/👎 só nas respostas das próprias conversas.
drop policy if exists message_feedback_own on public.message_feedback;
create policy message_feedback_own on public.message_feedback
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m join public.chats c on c.id = m.chat_id
      where m.id = message_feedback.message_id and c.user_id = auth.uid()
    )
  );

-- 4. Relatório de erros do app: no máximo 300 por minuto no total (evita encher a tabela de lixo).
create or replace function public.app_errors_flood_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.app_errors where created_at > now() - interval '1 minute') >= 300 then
    return null;  -- descarta em silêncio
  end if;
  return new;
end $$;
revoke all on function public.app_errors_flood_guard() from public, anon, authenticated;
drop trigger if exists app_errors_flood on public.app_errors;
create trigger app_errors_flood before insert on public.app_errors
  for each row execute function public.app_errors_flood_guard();

-- 5. Limpeza automática dos registros de uso antigos (só servem para contar o dia/hora).
--    Rode de vez em quando, ou agende no Supabase (Database → Cron):
--    delete from public.usage_events where created_at < now() - interval '60 days';
