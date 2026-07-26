import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/units/solo
 *
 * Creates a solo unit and locks it immediately.
 * The user becomes both leader and sole member.
 *
 * Uses the admin client for unit_members mutations — there's no INSERT
 * RLS policy on that table; the API validates permissions server-side.
 */
export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // ── Check registration is open ────────────────────────────────────────
  const { data: settings } = await adminSupabase
    .from("event_settings")
    .select("registration_open")
    .eq("id", 1)
    .single();

  if (!settings?.registration_open) {
    return NextResponse.json(
      { error: "Registration is closed." },
      { status: 400 }
    );
  }

  // ── Check user doesn't already have a unit ────────────────────────────
  const { data: existingMembership } = await adminSupabase
    .from("unit_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json(
      { error: "You're already part of a team or locked as solo." },
      { status: 400 }
    );
  }

  // ── Create the solo unit (unlocked initially) ──────────────────────────
  const { data: unit, error: unitError } = await adminSupabase
    .from("units")
    .insert({
      unit_type: "solo",
      leader_id: user.id,
      locked: false,
    })
    .select("id")
    .single();

  if (unitError) {
    console.error("Failed to create solo unit:", unitError.message);
    return NextResponse.json(
      { error: "Failed to create registration. Please try again." },
      { status: 500 }
    );
  }

  // ── Add user as the sole member ───────────────────────────────────────
  const { error: memberError } = await adminSupabase
    .from("unit_members")
    .insert({
      unit_id: unit.id,
      user_id: user.id,
      status: "accepted",
      responded_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error("Failed to add solo member:", memberError.message);
    return NextResponse.json(
      { error: "Registration created but membership failed. Contact an admin." },
      { status: 500 }
    );
  }

  // ── Now lock the unit ─────────────────────────────────────────────────
  await adminSupabase
    .from("units")
    .update({ locked: true, locked_at: new Date().toISOString() })
    .eq("id", unit.id);

  // ── Decline any pending invites this user had ─────────────────────────
  await adminSupabase
    .from("unit_members")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({ success: true, unit_id: unit.id });
}

