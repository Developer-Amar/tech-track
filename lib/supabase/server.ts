import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Uses the anon key — respects RLS policies.
 *
 * For operations that need to bypass RLS (e.g., reading hidden test cases,
 * running close_registration), use createAdminClient() instead.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from a Server Component where
            // cookies can't be set — this is expected and safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Admin Supabase client — uses the service role key to bypass RLS.
 * ONLY use server-side, NEVER expose to the client.
 * Used for: checking hidden test cases, running close_registration(),
 * admin-level mutations, audit log writes.
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Admin client doesn't need cookie persistence
        },
      },
    }
  );
}
