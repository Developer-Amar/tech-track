import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/registration/close
 *
 * Closes registration — calls the close_registration() DB function which:
 * 1. Converts zero-acceptance teams to solo
 * 2. Expires pending invites
 * 3. Locks all units
 * 4. Generates unique codes per (unit × checkpoint)
 *
 * Admin or Super Admin only.
 */
export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Role check ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Call close_registration() via service role ────────────────────────
  const adminSupabase = createAdminClient();

  const { error: closeError } = await adminSupabase.rpc("close_registration");

  if (closeError) {
    console.error("close_registration() failed:", closeError.message);
    return NextResponse.json(
      { error: closeError.message.includes("already closed")
          ? "Registration is already closed."
          : "Failed to close registration. " + closeError.message
      },
      { status: 400 }
    );
  }

  // ── Audit log ─────────────────────────────────────────────────────────
  await adminSupabase
    .from("audit_log")
    .insert({
      actor_id: user.id,
      action_type: "close_registration",
      action_detail: { timestamp: new Date().toISOString() },
    });

  return NextResponse.json({ success: true });
}
