import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * OAuth callback handler.
 *
 * Google redirects here after authentication → Supabase exchanges the code
 * for a session → we do a server-side domain re-check (the `hd` hint alone
 * is NOT a security control) → redirect to /complete-profile or /dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
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
            // Can fail in certain edge cases — safe to ignore
          }
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Auth code exchange failed:", exchangeError.message);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  // ── Server-side domain re-check (TRD §2) ──────────────────────────────
  // The hd hint only pre-filters the Google account picker — it's not a
  // security control. This is the hard backstop.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email?.endsWith("@chitkara.edu.in")) {
    // Sign them out immediately — they shouldn't have a session
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=domain`);
  }

  // ── Check if profile is complete ──────────────────────────────────────
  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed")
    .eq("id", user.id)
    .single();

  if (profile?.profile_completed) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/complete-profile`);
}
