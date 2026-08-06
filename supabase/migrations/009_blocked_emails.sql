-- ============================================================================
-- Blocked Emails Table
-- Tracks permanently banned emails that cannot re-register.
-- Only accessible via service_role (admin client) — RLS enabled, no policies.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blocked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  blocked_by uuid,
  reason text DEFAULT 'Blocked by admin',
  blocked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role (createAdminClient) can read/write.
-- This is intentional — blocked list should never be exposed to users.
