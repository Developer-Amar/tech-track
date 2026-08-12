-- ============================================================================
-- Pass Code — Unique scannable barcode identifier for each user's event pass
-- ============================================================================

-- Add pass_code column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pass_code text UNIQUE;

-- Add avatar_url column to store Google profile photo
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Function to generate a unique 8-character pass code
CREATE OR REPLACE FUNCTION public.generate_pass_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  -- Generate 8 random characters (excluding ambiguous: 0/O, 1/I/L)
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Backfill existing users who don't have a pass_code yet
DO $$
DECLARE
  r RECORD;
  new_code text;
  attempts int;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE pass_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := public.generate_pass_code();
      BEGIN
        UPDATE public.users SET pass_code = new_code WHERE id = r.id;
        EXIT; -- success
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 10 THEN
          RAISE EXCEPTION 'Could not generate unique pass_code after 10 attempts';
        END IF;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- Create index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_users_pass_code ON public.users(pass_code);
