-- ============================================================================
-- Tech Trek — Full Schema Migration
-- ============================================================================
-- Source: docs/Tech_Track_Backend_Schema.md v1.0
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Sections (run in this order, all in one go):
--   1. Tables           (Backend_Schema.md §2)
--   2. Functions         (Backend_Schema.md §3)
--   3. Triggers          (Backend_Schema.md §3)
--   4. RLS policies      (Backend_Schema.md §4)
--   5. Views             (Backend_Schema.md §5)
--   6. Indexes           (Backend_Schema.md §6)
--   7. Data API grants   (Backend_Schema.md §8)
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- §2  TABLE DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  mobile_number text,
  roll_no text,
  branch text,
  semester int,
  role text not null default 'participant'
    check (role in ('participant','checkpoint_staff','admin','super_admin')),
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A "unit" is a solo entry or a team, modeled identically throughout the app
create table public.units (
  id uuid primary key default gen_random_uuid(),
  unit_type text not null check (unit_type in ('solo','team')),
  name text,
  leader_id uuid not null references public.users(id),
  locked boolean not null default false,
  locked_at timestamptz,
  disqualified boolean not null default false,
  disqualified_reason text,
  disqualified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.unit_members (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  user_id uuid not null references public.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (unit_id, user_id)
);

-- The central "round" entity -- everything else attaches to a checkpoint
create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  location_name text not null,
  round_number int not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.riddles (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null unique references public.checkpoints(id) on delete cascade,
  content text not null,
  updated_at timestamptz not null default now()
);

create table public.checkpoint_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  checkpoint_id uuid not null references public.checkpoints(id) on delete cascade,
  unique (user_id, checkpoint_id)
);

-- Auto-generated per unit per checkpoint at registration close -- never typed by hand
create table public.unit_checkpoint_codes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  checkpoint_id uuid not null references public.checkpoints(id) on delete cascade,
  secret_code text not null,
  unique (unit_id, checkpoint_id)
);

create table public.coding_questions (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null unique references public.checkpoints(id) on delete cascade,
  prompt text not null,
  sample_input text,
  sample_output text,
  updated_at timestamptz not null default now()
);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.coding_questions(id) on delete cascade,
  input text not null,
  expected_output text not null,
  is_visible boolean not null default false
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  checkpoint_id uuid not null references public.checkpoints(id),
  code text not null,
  language text not null check (language in ('c','cpp','python','java')),
  passed boolean not null default false,
  attempt_number int not null,
  submitted_at timestamptz not null default now()
);

create table public.round_progress (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  checkpoint_id uuid not null references public.checkpoints(id),
  status text not null default 'pending' check (status in ('pending','skipped','passed')),
  points int not null default 0,
  completed_at timestamptz,
  unique (unit_id, checkpoint_id)
);

create table public.proctoring_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  checkpoint_id uuid references public.checkpoints(id),
  event_type text not null,
  occurred_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  message text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  action_type text not null,
  action_detail jsonb,
  created_at timestamptz not null default now()
);

create table public.event_settings (
  id int primary key default 1,
  registration_open boolean not null default true,
  event_live boolean not null default false,
  total_rounds int not null default 10,
  check (id = 1)
);


-- ════════════════════════════════════════════════════════════════════════════
-- §3  FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- New sign-up → profile row, with the domain check as a hard backstop.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email !~ '@chitkara\.edu\.in$' then
    raise exception 'Only chitkara.edu.in accounts are permitted';
  end if;

  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when new.email = 'amar4594.ece25@chitkara.edu.in' then 'super_admin' else 'participant' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- Invite responses are one-shot — accept or decline, once, no take-backs.
create or replace function public.validate_invite_response()
returns trigger
language plpgsql
as $$
begin
  if old.status != 'pending' then
    raise exception 'This invite has already been responded to';
  end if;
  if new.status not in ('accepted','declined') then
    raise exception 'Invalid response';
  end if;
  return new;
end;
$$;

create trigger enforce_invite_response
  before update on public.unit_members
  for each row execute function public.validate_invite_response();


-- Once a unit is locked, its roster is frozen.
create or replace function public.prevent_locked_unit_member_changes()
returns trigger
language plpgsql
as $$
begin
  if (select locked from public.units where id = coalesce(new.unit_id, old.unit_id)) then
    raise exception 'This unit is locked and its roster cannot be changed';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger enforce_unit_lock_on_members
  before insert or update or delete on public.unit_members
  for each row execute function public.prevent_locked_unit_member_changes();


-- Readable code generator — avoids 0/O and 1/I/l confusion.
create or replace function public.generate_readable_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;


-- close_registration() — the single function behind the Admin panel's
-- "close registration" button.
create or replace function public.close_registration()
returns void
language plpgsql
security definer
as $$
declare
  team_unit record;
  cp record;
begin
  if (select registration_open from public.event_settings where id = 1) = false then
    raise exception 'Registration is already closed';
  end if;

  -- 1. Teams with zero accepted members convert to a solo entry for their leader
  for team_unit in
    select u.id, u.leader_id
    from public.units u
    where u.unit_type = 'team'
      and not exists (
        select 1 from public.unit_members m where m.unit_id = u.id and m.status = 'accepted'
      )
  loop
    update public.units set unit_type = 'solo', name = null where id = team_unit.id;
    insert into public.unit_members (unit_id, user_id, status, responded_at)
    values (team_unit.id, team_unit.leader_id, 'accepted', now())
    on conflict (unit_id, user_id) do update set status = 'accepted', responded_at = now();
  end loop;

  -- 2. Any invite still pending expires
  update public.unit_members set status = 'declined', responded_at = now() where status = 'pending';

  -- 3. Lock everything, now that rosters are final
  update public.units set locked = true, locked_at = now() where locked = false;

  -- 4. Generate one unique code per (unit x checkpoint) pair
  for cp in select id from public.checkpoints loop
    insert into public.unit_checkpoint_codes (unit_id, checkpoint_id, secret_code)
    select u.id, cp.id, public.generate_readable_code()
    from public.units u
    where u.locked = true
    on conflict (unit_id, checkpoint_id) do nothing;
  end loop;

  update public.event_settings set registration_open = false where id = 1;
end;
$$;


-- updated_at housekeeping
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.checkpoints
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.riddles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.coding_questions
  for each row execute function public.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- §4  ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

-- Helper so policies don't repeat the same subquery everywhere.
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.users where id = auth.uid();
$$;

-- users
alter table public.users enable row level security;
create policy "self read" on public.users for select using (id = auth.uid());
create policy "self update" on public.users for update using (id = auth.uid());
create policy "admin read all users" on public.users for select
  using (public.current_user_role() in ('admin','super_admin'));

-- units
alter table public.units enable row level security;
create policy "members read own unit" on public.units for select
  using (id in (select unit_id from public.unit_members where user_id = auth.uid()));
create policy "leader creates unit" on public.units for insert with check (leader_id = auth.uid());
create policy "admin read all units" on public.units for select
  using (public.current_user_role() in ('admin','super_admin'));
create policy "admin manage units" on public.units for update
  using (public.current_user_role() in ('admin','super_admin'));

-- unit_members
alter table public.unit_members enable row level security;
create policy "members read own roster" on public.unit_members for select
  using (unit_id in (select unit_id from public.unit_members where user_id = auth.uid()));
create policy "invitee responds" on public.unit_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read all memberships" on public.unit_members for select
  using (public.current_user_role() in ('admin','super_admin'));

-- unit_checkpoint_codes
alter table public.unit_checkpoint_codes enable row level security;
create policy "unit reads own current code" on public.unit_checkpoint_codes for select
  using (unit_id in (select unit_id from public.unit_members where user_id = auth.uid()));
create policy "staff reads assigned checkpoint codes" on public.unit_checkpoint_codes for select
  using (checkpoint_id in (select checkpoint_id from public.checkpoint_staff_assignments where user_id = auth.uid()));
create policy "admin reads all codes" on public.unit_checkpoint_codes for select
  using (public.current_user_role() in ('admin','super_admin'));

-- checkpoint_staff_assignments
alter table public.checkpoint_staff_assignments enable row level security;
create policy "staff reads own assignments" on public.checkpoint_staff_assignments
  for select using (user_id = auth.uid());
create policy "admin manages staff assignments" on public.checkpoint_staff_assignments
  for all using (public.current_user_role() in ('admin','super_admin'));

-- test_cases
alter table public.test_cases enable row level security;
create policy "only visible test cases readable" on public.test_cases for select using (is_visible = true);
create policy "admin reads all test cases" on public.test_cases for select
  using (public.current_user_role() in ('admin','super_admin'));

-- submissions
alter table public.submissions enable row level security;
create policy "unit reads own submissions" on public.submissions for select
  using (unit_id in (select unit_id from public.unit_members where user_id = auth.uid()));
create policy "unit inserts own submissions" on public.submissions for insert
  with check (unit_id in (select unit_id from public.unit_members where user_id = auth.uid()));
create policy "admin reads all submissions" on public.submissions for select
  using (public.current_user_role() in ('admin','super_admin'));

-- round_progress
alter table public.round_progress enable row level security;
create policy "unit reads own progress" on public.round_progress for select
  using (unit_id in (select unit_id from public.unit_members where user_id = auth.uid()));
create policy "admin reads all progress" on public.round_progress for select
  using (public.current_user_role() in ('admin','super_admin'));

-- proctoring_events
alter table public.proctoring_events enable row level security;
create policy "admin reads proctoring events" on public.proctoring_events for select
  using (public.current_user_role() in ('admin','super_admin'));

-- notifications
alter table public.notifications enable row level security;
create policy "unit reads own notifications" on public.notifications for select
  using (unit_id in (select unit_id from public.unit_members where user_id = auth.uid()));

-- announcements
alter table public.announcements enable row level security;
create policy "any signed-in user reads announcements" on public.announcements for select
  using (auth.role() = 'authenticated');

-- content tables + audit log
alter table public.riddles enable row level security;
alter table public.coding_questions enable row level security;
alter table public.checkpoints enable row level security;
create policy "admin manages riddles" on public.riddles for all
  using (public.current_user_role() in ('admin','super_admin'));
create policy "admin manages questions" on public.coding_questions for all
  using (public.current_user_role() in ('admin','super_admin'));
create policy "admin manages checkpoints" on public.checkpoints for all
  using (public.current_user_role() in ('admin','super_admin'));

alter table public.audit_log enable row level security;
create policy "admin reads audit log" on public.audit_log for select
  using (public.current_user_role() in ('admin','super_admin'));


-- ════════════════════════════════════════════════════════════════════════════
-- §5  VIEWS
-- ════════════════════════════════════════════════════════════════════════════

create or replace view public.leaderboard_view as
select
  u.id as unit_id,
  u.name,
  u.unit_type,
  u.disqualified,
  coalesce(sum(rp.points) filter (where rp.status = 'passed'), 0) as total_points,
  max(rp.completed_at) filter (where rp.status = 'passed') as last_point_at
from public.units u
left join public.round_progress rp on rp.unit_id = u.id
where u.locked = true
group by u.id, u.name, u.unit_type, u.disqualified
order by total_points desc;

create or replace view public.admin_unit_overview as
select
  u.id as unit_id,
  u.name,
  u.unit_type,
  u.locked,
  u.disqualified,
  json_agg(
    json_build_object('name', usr.name, 'email', usr.email,
      'role', case when usr.id = u.leader_id then 'leader' else 'member' end)
  ) as members,
  coalesce(lb.total_points, 0) as total_points
from public.units u
join public.unit_members um on um.unit_id = u.id and um.status = 'accepted'
join public.users usr on usr.id = um.user_id
left join public.leaderboard_view lb on lb.unit_id = u.id
group by u.id, u.name, u.unit_type, u.locked, u.disqualified, lb.total_points;


-- ════════════════════════════════════════════════════════════════════════════
-- §6  INDEXES
-- ════════════════════════════════════════════════════════════════════════════

create index idx_unit_members_user_id on public.unit_members(user_id);
create index idx_unit_members_unit_id on public.unit_members(unit_id);
create index idx_codes_unit_id on public.unit_checkpoint_codes(unit_id);
create index idx_codes_checkpoint_id on public.unit_checkpoint_codes(checkpoint_id);
create index idx_submissions_unit_id on public.submissions(unit_id);
create index idx_round_progress_unit_id on public.round_progress(unit_id);
create index idx_proctoring_unit_id on public.proctoring_events(unit_id);
create index idx_notifications_unit_id on public.notifications(unit_id);
create index idx_staff_assignments_user_id on public.checkpoint_staff_assignments(user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- §8  DATA API GRANTS
-- ════════════════════════════════════════════════════════════════════════════
-- Supabase changed a default (May 30 2026): new projects no longer auto-expose
-- tables to the Data API just because RLS is enabled. Without explicit grants,
-- every query fails with a permissions error.

grant usage on schema public to authenticated;

grant select, update on public.users to authenticated;
grant select, insert, update on public.units to authenticated;
grant select, insert, update on public.unit_members to authenticated;
grant select on public.checkpoints to authenticated;
grant select on public.riddles to authenticated;
grant select on public.checkpoint_staff_assignments to authenticated;
grant select on public.unit_checkpoint_codes to authenticated;
grant select on public.coding_questions to authenticated;
grant select on public.test_cases to authenticated;
grant select, insert on public.submissions to authenticated;
grant select on public.round_progress to authenticated;
grant select, insert on public.proctoring_events to authenticated;
grant select on public.notifications to authenticated;
grant select on public.announcements to authenticated;
grant select on public.audit_log to authenticated;

-- Grant access to views
grant select on public.leaderboard_view to authenticated;
grant select on public.admin_unit_overview to authenticated;

-- event_settings: read by everyone, written only via service role
grant select on public.event_settings to authenticated;
