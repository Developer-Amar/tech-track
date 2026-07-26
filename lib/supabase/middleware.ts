import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase middleware — refreshes the auth session on every request
 * and enforces route-level access control:
 *
 * - /dashboard, /event     → require auth + profile_completed
 * - /admin                 → require auth (role check happens in the layout)
 * - /login, /complete-profile → redirect away if already fully set up
 * - /, /auth/*, /api/*     → public, no gate
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — main purpose of this middleware
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ── Public routes — no gate ───────────────────────────────────────────
  if (
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  ) {
    return supabaseResponse;
  }

  // ── Protected routes — require authentication ─────────────────────────
  const protectedPaths = ["/dashboard", "/event", "/admin"];
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Profile-gated routes — require profile_completed ──────────────────
  const profileGatedPaths = ["/dashboard", "/event"];
  const isProfileGated = profileGatedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProfileGated && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("profile_completed")
      .eq("id", user.id)
      .single();

    if (!profile?.profile_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/complete-profile";
      return NextResponse.redirect(url);
    }
  }

  // ── Auth pages — redirect away if already signed in + complete ────────
  const authPaths = ["/login", "/complete-profile"];
  const isAuthPage = authPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isAuthPage && user) {
    // If on /login and profile is incomplete, let them go to /complete-profile
    if (pathname.startsWith("/login")) {
      const { data: profile } = await supabase
        .from("users")
        .select("profile_completed")
        .eq("id", user.id)
        .single();

      if (profile?.profile_completed) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      } else {
        const url = request.nextUrl.clone();
        url.pathname = "/complete-profile";
        return NextResponse.redirect(url);
      }
    }

    // If on /complete-profile and already complete, go to dashboard
    if (pathname.startsWith("/complete-profile")) {
      const { data: profile } = await supabase
        .from("users")
        .select("profile_completed")
        .eq("id", user.id)
        .single();

      if (profile?.profile_completed) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
