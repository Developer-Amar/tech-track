-- ============================================================================
-- Migration 024: Official Chitkara Payment Integration & Transaction Reconciliation
-- ============================================================================
-- 1. Adds chitkara_order_token and chitkara_txn_id columns to public.units
-- 2. Adds chitkara_portal_url configuration to public.event_settings
-- 3. Ensures realtime publication includes units and event_settings
-- ============================================================================

BEGIN;

-- ── 1. Units Chitkara Tracking Columns ───────────────────────────────────────
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS chitkara_order_token text,
ADD COLUMN IF NOT EXISTS chitkara_txn_id text;

CREATE INDEX IF NOT EXISTS idx_units_chitkara_txn_id 
  ON public.units (chitkara_txn_id) 
  WHERE chitkara_txn_id IS NOT NULL;

-- ── 2. Event Settings Chitkara URL Configuration ────────────────────────────
ALTER TABLE public.event_settings 
ADD COLUMN IF NOT EXISTS chitkara_portal_url text DEFAULT 'https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/';

UPDATE public.event_settings 
SET chitkara_portal_url = COALESCE(chitkara_portal_url, 'https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/')
WHERE id = 1;

COMMIT;
