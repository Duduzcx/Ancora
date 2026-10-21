-- =====================================================================
-- Nórica — Faculdade (matérias, provas/trabalhos e tarefas) · 1.9.0
-- Rode no SQL Editor do Supabase depois de 20261022090000_norica_caderno.sql. Idempotente.
-- Cada pessoa só vê e mexe nas próprias matérias (RLS).
-- =====================================================================

-- 1. Matérias
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null default 'emerald' check (color in ('emerald', 'sky', 'violet', 'amber', 'rose', 'teal', 'orange', 'indigo')),
  professor   text check (professor is null or char_length(professor) <= 60),
  room        text check (room is null or char_length(room) <= 40),
  schedule    jsonb not null default '[]'::jsonb,   -- [{"dia":1,"inicio":"19:00","fim":"20:40"}] (0 = domingo)
  page        text not null default '' check (char_length(page) <= 20000),  -- página livre da matéria
  pass_grade  numeric(5,2) not null default 6 check (pass_grade between 0 and 100),
  archived    boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists courses_user_idx on public.courses (user_id, archived, position);

-- 2. Datas importantes (provas, trabalhos, entregas, apresentações)
create table if not exists public.course_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete cascade,
  kind        text not null default 'prova' check (kind in ('prova', 'trabalho', 'entrega', 'apresentacao', 'outro')),
  title       text not null check (char_length(title) between 1 and 80),
  day         date not null,
  at_time     time,
  notes       text check (notes is null or char_length(notes) <= 1000),
  done        boolean not null default false,
  grade       numeric(6,2) check (grade is null or grade >= 0),
  max_grade   numeric(6,2) not null default 10 check (max_grade > 0),
  weight      numeric(5,2) not null default 1 check (weight > 0),
  created_at  timestamptz not null default now()
);
create index if not exists course_events_user_day_idx on public.course_events (user_id, day);

-- 3. Tarefas ("para fazer") de cada matéria
create table if not exists public.course_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 140),
  due         date,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists course_tasks_user_idx on public.course_tasks (user_id, done, due);

alter table public.courses       enable row level security;
alter table public.course_events enable row level security;
alter table public.course_tasks  enable row level security;
do $$
declare
  t text;
begin
  foreach t in array array['courses', 'course_events', 'course_tasks'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t
      );
    end if;
  end loop;
end $$;
revoke all on public.courses, public.course_events, public.course_tasks from anon;
grant select, insert, update, delete on public.courses, public.course_events, public.course_tasks to authenticated;

-- Uma data ou tarefa só pode apontar para uma matéria da mesma pessoa.
create or replace function public.course_owner_check() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.course_id is not null and not exists (select 1 from public.courses c where c.id = new.course_id and c.user_id = new.user_id) then
    raise exception 'matéria inválida';
  end if;
  return new;
end $$;
drop trigger if exists course_events_owner on public.course_events;
create trigger course_events_owner before insert or update on public.course_events for each row execute function public.course_owner_check();
drop trigger if exists course_tasks_owner on public.course_tasks;
create trigger course_tasks_owner before insert or update on public.course_tasks for each row execute function public.course_owner_check();
