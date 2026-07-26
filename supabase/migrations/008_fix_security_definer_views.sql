-- Fix SECURITY DEFINER views flagged by Supabase Advisor.
-- Recreate both views with SECURITY INVOKER so they respect
-- Row-Level Security policies instead of bypassing them.

-- These views are read-only aggregations used by the leaderboard
-- and admin panel. They only need SELECT access which is already
-- granted to authenticated users.

create or replace view public.leaderboard_view
with (security_invoker = on)
as
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

create or replace view public.admin_unit_overview
with (security_invoker = on)
as
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
