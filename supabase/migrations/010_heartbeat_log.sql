-- ============================================================================
-- Heartbeat Log Table — Tracks keep-alive pings to prevent Supabase pausing
-- Single-row table, upserted by /api/health on every ping.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.heartbeat_log (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Single-row table
  last_ping timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'health-endpoint',
  ping_count int NOT NULL DEFAULT 1
);

ALTER TABLE public.heartbeat_log ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role can access (admin client only)

-- Insert initial row
INSERT INTO public.heartbeat_log (id, last_ping, source, ping_count)
VALUES (1, now(), 'migration', 0)
ON CONFLICT (id) DO NOTHING;

-- Function to atomically increment the ping count
CREATE OR REPLACE FUNCTION public.increment_heartbeat_count()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.heartbeat_log
  SET ping_count = ping_count + 1,
      last_ping = now()
  WHERE id = 1;
$$;
