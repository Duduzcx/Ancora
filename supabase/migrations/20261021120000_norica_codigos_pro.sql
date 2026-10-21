-- =====================================================================
-- Nórica — códigos de Pro (para amigos que testam o app, parceiros, sorteios)
-- Rode no SQL Editor do Supabase depois de 20261018090000_norica_b2b_hoje.sql. Idempotente.
--
-- Criar um código (exemplo: 20 amigos, 90 dias de Pro cada):
--   insert into public.promo_codes (code, days, max_uses, note)
--   values ('AMIGOS2026', 90, 20, 'amigos que testam o app');
-- Ver quem usou:
--   select r.code, r.redeemed_at, u.email from public.promo_redemptions r
--   join auth.users u on u.id = r.user_id order by r.redeemed_at desc;
-- Desligar um código: update public.promo_codes set active = false where code = 'AMIGOS2026';
-- =====================================================================

create table if not exists public.promo_codes (
  code        text primary key check (code = upper(code) and code ~ '^[A-Z0-9-]{4,32}$'),
  days        int  not null default 30 check (days between 1 and 3650),
  max_uses    int  not null default 1 check (max_uses >= 1),
  uses        int  not null default 0,
  active      boolean not null default true,
  expires_at  timestamptz,                -- opcional: data em que o código deixa de valer
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  code         text not null references public.promo_codes(code) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  redeemed_at  timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on public.promo_codes, public.promo_redemptions from anon, authenticated;

-- Tentativas de código contam no uso (limite de tentativas por dia contra chute).
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('porto_message', 'arena_feedback', 'tts', 'promo_try'));

-- Usa um código de forma atômica (duas pessoas ao mesmo tempo não passam do limite).
create or replace function public.redeem_promo(p_code text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c   public.promo_codes%rowtype;
  cur public.user_plans%rowtype;
  base_ts  timestamptz;
  until_ts timestamptz;
begin
  select * into c from public.promo_codes where code = upper(trim(p_code)) for update;
  if not found or not c.active or (c.expires_at is not null and c.expires_at < now()) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if exists (select 1 from public.promo_redemptions where code = c.code and user_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  if c.uses >= c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  select * into cur from public.user_plans where user_id = p_user for update;
  if found and cur.plan = 'pro' and cur.store = 'google_play' and cur.pro_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'paid');
  end if;
  if found and cur.plan = 'pro' and cur.pro_until is null then
    return jsonb_build_object('ok', false, 'reason', 'already'); -- Pro sem prazo (dado pela equipe)
  end if;

  -- Se já tem Pro por código, soma os dias ao que falta.
  base_ts := greatest(now(), coalesce(case when found and cur.plan = 'pro' then cur.pro_until end, now()));
  until_ts := base_ts + make_interval(days => c.days);

  insert into public.promo_redemptions (code, user_id) values (c.code, p_user);
  update public.promo_codes set uses = uses + 1 where code = c.code;
  insert into public.user_plans (user_id, plan, pro_until, store, updated_at)
  values (p_user, 'pro', until_ts, 'promo', now())
  on conflict (user_id) do update
    set plan = 'pro', pro_until = until_ts, store = 'promo', updated_at = now();

  return jsonb_build_object('ok', true, 'proUntil', until_ts, 'days', c.days);
end;
$$;

revoke all on function public.redeem_promo(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_promo(text, uuid) to service_role;
