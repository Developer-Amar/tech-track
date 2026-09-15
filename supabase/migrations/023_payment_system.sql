-- ============================================================================
-- Migration 023: Tech Trek Cyberpunk Payment Portal & Operational Clearance System
-- ============================================================================
-- 1. Adds payment status, UTR tracking, amount, submission & verification audit columns to public.units
-- 2. Adds UPI payment configuration, payee name, payment gate toggle, and deadline to public.event_settings
-- 3. Adds unique constraint on payment_utr to prevent transaction replay fraud
-- 4. Ensures public.units and public.event_settings are published to supabase_realtime
-- ============================================================================

BEGIN;

-- ── 1. Units Payment Tracking Columns ───────────────────────────────────────
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_utr text,
ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_verified_by uuid REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'upi',
ADD COLUMN IF NOT EXISTS payment_notes text;

-- Add check constraint for payment_status safely if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'units_payment_status_check'
  ) THEN
    ALTER TABLE public.units 
    ADD CONSTRAINT units_payment_status_check 
    CHECK (payment_status IN ('unpaid', 'pending', 'verified', 'rejected'));
  END IF;
END $$;

-- ── 2. Unique Index to Prevent UTR Replay Fraud ────────────────────────────
-- Ensures no two teams can ever claim or register the exact same UTR transaction reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_units_payment_utr 
  ON public.units (payment_utr) 
  WHERE payment_utr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_payment_status 
  ON public.units (payment_status);

-- ── 3. Event Settings Payment Configuration ─────────────────────────────────
ALTER TABLE public.event_settings 
ADD COLUMN IF NOT EXISTS payment_upi_id text DEFAULT 'amardeveloper3@okhdfcbank',
ADD COLUMN IF NOT EXISTS payment_payee_name text DEFAULT 'Tech Trek IEI x IETE',
ADD COLUMN IF NOT EXISTS require_payment_for_event boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_deadline timestamptz DEFAULT '2026-09-30T11:00:00+05:30';

-- Seed / Update initial event_settings row (id = 1)
UPDATE public.event_settings 
SET payment_upi_id = COALESCE(payment_upi_id, 'amardeveloper3@okhdfcbank'),
    payment_payee_name = COALESCE(payment_payee_name, 'Tech Trek IEI x IETE'),
    require_payment_for_event = COALESCE(require_payment_for_event, true),
    payment_deadline = COALESCE(payment_deadline, '2026-09-30T11:00:00+05:30'::timestamptz)
WHERE id = 1;

-- ── 4. Supabase Realtime Publication ───────────────────────────────────────
-- Safe publication registration without ALTER PUBLICATION syntax errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'units'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.units;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_settings;
  END IF;
END $$;

COMMIT;
