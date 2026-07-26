-- Phase 6: Announcements, Proctoring, Points
-- Run this in the Supabase SQL Editor.

-- ── Announcements table ──────────────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users(id),
  content text not null,
  priority text default 'normal' check (priority in ('normal', 'urgent')),
  created_at timestamptz default now()
);
alter table public.announcements enable row level security;
create policy "Authenticated users can read announcements"
  on public.announcements for select
  to authenticated using (true);

-- ── Proctoring state (per unit × checkpoint) ─────────────────────────────
create table if not exists public.proctoring_state (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete cascade,
  tab_switches integer default 0,
  tab_switch_limit integer default 3,
  locked_out boolean default false,
  flagged_at timestamptz,
  created_at timestamptz default now(),
  unique(unit_id, checkpoint_id)
);
alter table public.proctoring_state enable row level security;

-- ── Add tab_switches + flagged to submissions ────────────────────────────
alter table public.submissions
  add column if not exists tab_switches integer default 0,
  add column if not exists flagged boolean default false;

-- ── Update round_progress status values ──────────────────────────────────
-- Drop old check constraint if it exists, add new one with expanded values
-- (the original schema may not have a check constraint on status, so this is safe)
do $$
begin
  -- Try to drop the old constraint
  alter table public.round_progress drop constraint if exists round_progress_status_check;
exception when others then
  null; -- ignore if it doesn't exist
end $$;

alter table public.round_progress
  add constraint round_progress_status_check
  check (status in ('riddle_done', 'checkpoint_done', 'passed', 'skipped', 'pending'));

-- Migrate any existing 'pending' rows that had points=0 → 'riddle_done'
-- and pending with points=1 → 'checkpoint_done'
update public.round_progress set status = 'riddle_done' where status = 'pending' and points = 0;
update public.round_progress set status = 'checkpoint_done' where status = 'pending' and points = 1;

select 'Phase 6 migration complete' as result;
