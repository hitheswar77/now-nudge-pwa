-- ============================================================
-- Now Nudge — Supabase Schema  (run once in SQL Editor)
-- ============================================================

create table if not exists public.nudges (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  latitude   double precision not null default 0,
  longitude  double precision not null default 0,
  radius_m   int  not null default 500,
  created_at timestamptz not null default now()
);

alter table public.nudges enable row level security;

-- DROP first so re-running this script never errors
drop policy if exists "Public read"   on public.nudges;
drop policy if exists "Public insert" on public.nudges;

create policy "Public read"   on public.nudges for select using (true);
create policy "Public insert" on public.nudges for insert with check (true);
