-- ============================================================================
-- Migration: Remove Solo Participation
-- ============================================================================
-- Solo units are no longer supported. All participation is team-based (2–4 members).
-- This migration:
--   1. Converts any existing solo units to team type
--   2. Updates the CHECK constraint on units.unit_type
--   3. Updates close_registration() to disqualify abandoned teams instead of
--      converting them to solo
--   4. Recreates views that reference unit_type
-- ============================================================================

-- ── 1. Convert existing solo units to team ──────────────────────────────────
UPDATE public.units SET unit_type = 'team' WHERE unit_type = 'solo';

-- ── 2. Update CHECK constraint to only allow 'team' ────────────────────────
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_unit_type_check;
ALTER TABLE public.units ADD CONSTRAINT units_unit_type_check CHECK (unit_type in ('team'));

-- ── 3. Replace close_registration() function ────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_registration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  abandoned_unit RECORD;
BEGIN
  -- Guard: only run once
  IF NOT (SELECT registration_open FROM public.event_settings WHERE id = 1) THEN
    RAISE EXCEPTION 'Registration is already closed';
  END IF;

  -- 1. Disqualify teams with zero accepted members (excluding the leader)
  --    These are teams where nobody accepted the invite.
  FOR abandoned_unit IN
    SELECT u.id
    FROM public.units u
    WHERE u.locked = false
      AND (
        SELECT COUNT(*)
        FROM public.unit_members um
        WHERE um.unit_id = u.id AND um.status = 'accepted'
      ) <= 1  -- only the leader accepted (auto-accepted on creation)
  LOOP
    UPDATE public.units
    SET disqualified = true,
        disqualified_reason = 'No team members accepted. Contact admin for assistance.',
        disqualified_at = now(),
        locked = true,
        locked_at = now()
    WHERE id = abandoned_unit.id;
  END LOOP;

  -- 2. Expire all remaining pending invites
  UPDATE public.unit_members
  SET status = 'declined', responded_at = now()
  WHERE status = 'pending';

  -- 3. Lock all remaining unlocked units
  UPDATE public.units
  SET locked = true, locked_at = now()
  WHERE locked = false;

  -- 4. Flip the registration gate
  UPDATE public.event_settings
  SET registration_open = false
  WHERE id = 1;

  -- 5. Generate verification codes for each (unit × checkpoint) pair
  INSERT INTO public.unit_checkpoint_codes (unit_id, checkpoint_id, secret_code)
  SELECT u.id, c.id, encode(gen_random_bytes(4), 'hex')
  FROM public.units u
  CROSS JOIN public.checkpoints c
  WHERE u.disqualified = false
  ON CONFLICT (unit_id, checkpoint_id) DO NOTHING;
END;
$$;

-- ── 4. Recreate views (same structure, just ensuring consistency) ───────────
-- These views already exist from migration 008 but we recreate to ensure
-- they work correctly with the team-only constraint.

DROP VIEW IF EXISTS public.admin_unit_overview;
DROP VIEW IF EXISTS public.leaderboard_view;
CREATE VIEW public.leaderboard_view WITH (security_invoker = true) AS
SELECT
  u.id,
  u.name,
  u.unit_type,
  COALESCE(SUM(rp.points), 0) AS total_points,
  COUNT(rp.id) FILTER (WHERE rp.status = 'passed') AS rounds_completed,
  MAX(rp.completed_at) AS last_completed_at,
  u.disqualified
FROM public.units u
LEFT JOIN public.round_progress rp ON rp.unit_id = u.id
GROUP BY u.id, u.name, u.unit_type, u.disqualified;

DROP VIEW IF EXISTS public.admin_unit_overview;
CREATE VIEW public.admin_unit_overview WITH (security_invoker = true) AS
SELECT
  u.id,
  u.name,
  u.unit_type,
  u.locked,
  u.disqualified,
  COALESCE(lb.total_points, 0) AS total_points,
  COUNT(um.id) FILTER (WHERE um.status = 'accepted') AS member_count,
  (SELECT usr.name FROM public.users usr WHERE usr.id = u.leader_id) AS leader_name
FROM public.units u
LEFT JOIN public.unit_members um ON um.unit_id = u.id
LEFT JOIN public.leaderboard_view lb ON lb.id = u.id
GROUP BY u.id, u.name, u.unit_type, u.locked, u.disqualified, lb.total_points;
