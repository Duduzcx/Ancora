-- =====================================================================
-- Nórica — planos Gratuito e Pro + contagem de uso
-- Rodar depois de 20261015120000_norica_melhorias.sql. Idempotente.
-- =====================================================================

-- Plano de cada conta. Só o servidor (service role) altera: o usuário apenas lê o próprio.
create table if not exists public.user_plans (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  plan             text not null default 'free' check (plan in ('free', 'pro')),
  pro_until        timestamptz,
  pro_interest_at  timestamptz,
  purchase_token   text unique,           -- token da assinatura na Google Play
  store            text,                  -- 'google_play' (ou 'manual' para Pro dado pela equipe)
  updated_at       timestamptz not null default now()
);
alter table public.user_plans add column if not exists purchase_token text unique;
alter table public.user_plans add column if not exists store text;

-- Uso diário para os limites do plano Gratuito (mensagens do Porto, retornos da Arena).
create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('porto_message', 'arena_feedback')),
  created_at  timestamptz not null default now()
);
create index if not exists usage_events_user_kind_created_idx on public.usage_events (user_id, kind, created_at desc);

alter table public.user_plans   enable row level security;
alter table public.usage_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_plans' and policyname = 'user_plans_read_own') then
    create policy user_plans_read_own on public.user_plans for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events' and policyname = 'usage_events_read_own') then
    create policy usage_events_read_own on public.usage_events for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

revoke all on public.user_plans, public.usage_events from anon;
revoke insert, update, delete on public.user_plans, public.usage_events from authenticated;

-- Para dar Pro manualmente a alguém (ex.: parceiro, piloto):
--   insert into public.user_plans (user_id, plan, pro_until)
--   values ('<uuid do usuário>', 'pro', now() + interval '90 days')
--   on conflict (user_id) do update set plan = 'pro', pro_until = excluded.pro_until, updated_at = now();
