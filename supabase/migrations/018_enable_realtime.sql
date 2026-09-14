-- ============================================================================
-- Tech Trek 2.0 — Enable Realtime Publication
-- ============================================================================

BEGIN;

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    CREATE PUBLICATION supabase_realtime; 
  END IF; 
END $$;

-- Add all relevant tables to the publication for frontend realtime sync
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.users, 
  public.units, 
  public.unit_members, 
  public.event_settings, 
  public.checkpoints, 
  public.submissions, 
  public.round_progress;

COMMIT;
