-- ============================================================================
-- Fix: infinite recursion in RLS policies
-- ============================================================================
-- The unit_members SELECT policy references unit_members in its own USING
-- clause, causing infinite recursion. Fix: use a SECURITY DEFINER function
-- to look up the user's unit IDs without going through RLS.
-- ============================================================================

-- 1. Create the helper function (bypasses RLS)
create or replace function public.get_user_unit_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select unit_id from public.unit_members where user_id = auth.uid();
$$;

-- Also make the trigger function security definer so it can read units.locked
-- without hitting the units RLS policy (which also references unit_members)
create or replace function public.prevent_locked_unit_member_changes()
returns trigger
language plpgsql
security definer
as $$
begin
  if (select locked from public.units where id = coalesce(new.unit_id, old.unit_id)) then
    raise exception 'This unit is locked and its roster cannot be changed';
  end if;
  return coalesce(new, old);
end;
$$;

-- 2. Drop the recursive policies
drop policy if exists "members read own roster" on public.unit_members;
drop policy if exists "members read own unit" on public.units;
drop policy if exists "unit reads own current code" on public.unit_checkpoint_codes;
drop policy if exists "unit reads own submissions" on public.submissions;
drop policy if exists "unit inserts own submissions" on public.submissions;
drop policy if exists "unit reads own progress" on public.round_progress;
drop policy if exists "unit reads own notifications" on public.notifications;

-- 3. Recreate them using the helper function
create policy "members read own roster" on public.unit_members for select
  using (unit_id in (select public.get_user_unit_ids()));

create policy "members read own unit" on public.units for select
  using (id in (select public.get_user_unit_ids()));

create policy "unit reads own current code" on public.unit_checkpoint_codes for select
  using (unit_id in (select public.get_user_unit_ids()));

create policy "unit reads own submissions" on public.submissions for select
  using (unit_id in (select public.get_user_unit_ids()));

create policy "unit inserts own submissions" on public.submissions for insert
  with check (unit_id in (select public.get_user_unit_ids()));

create policy "unit reads own progress" on public.round_progress for select
  using (unit_id in (select public.get_user_unit_ids()));

create policy "unit reads own notifications" on public.notifications for select
  using (unit_id in (select public.get_user_unit_ids()));

-- 4. Grant execute on the helper
grant execute on function public.get_user_unit_ids() to authenticated;
