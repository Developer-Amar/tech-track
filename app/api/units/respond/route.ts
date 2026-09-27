import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/units/respond
 *
 * Accept or decline a team invite. One-shot — can't change after responding.
 * The validate_invite_response trigger enforces this at the DB level too.
 *
 * Uses admin client for DB operations — auth validated via user session first.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { unit_id?: string; response?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { unit_id, response: inviteResponse } = body;

  if (!unit_id || !inviteResponse) {
    return NextResponse.json({ error: "unit_id and response are required." }, { status: 400 });
  }

  if (inviteResponse !== "accepted" && inviteResponse !== "declined") {
    return NextResponse.json(
      { error: "Response must be 'accepted' or 'declined'." },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // ── Verify this user actually has a pending invite for this unit ───────
  const { data: pendingInvite } = await adminSupabase
    .from("unit_members")
    .select("id")
    .eq("unit_id", unit_id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!pendingInvite) {
    return NextResponse.json(
      { error: "No pending invite found for this team." },
      { status: 400 }
    );
  }

  // ── If accepting, check user isn't already in another unit & team isn't full ────
  if (inviteResponse === "accepted") {
    const { data: existingMembership } = await adminSupabase
      .from("unit_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json(
        { error: "You're already part of a team." },
        { status: 400 }
      );
    }

    const { count: memberCount } = await adminSupabase
      .from("unit_members")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unit_id)
      .eq("status", "accepted");

    if ((memberCount ?? 0) >= 4) {
      return NextResponse.json(
        { error: "This team has already reached the maximum of 4 members." },
        { status: 400 }
      );
    }
  }

  // ── Update the invite ─────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from("unit_members")
    .update({
      status: inviteResponse,
      responded_at: new Date().toISOString(),
    })
    .eq("unit_id", unit_id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("Invite response failed:", updateError.message);
    return NextResponse.json(
      { error: "Failed to respond to invite. Please try again." },
      { status: 400 }
    );
  }

  // ── If accepting, decline all other pending invites ───────────────────
  if (inviteResponse === "accepted") {
    await adminSupabase
      .from("unit_members")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .neq("unit_id", unit_id);
  }

  return NextResponse.json({ success: true });
}

/**
 * GET /api/units/respond
 *
 * Returns all active pending invites for the authenticated user.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: pendingMemberships } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "pending");

  const pendingInvites: {
    unit_id: string;
    team_name: string | null;
    leader_name: string;
  }[] = [];

  if (pendingMemberships && pendingMemberships.length > 0) {
    const unitIds = pendingMemberships.map((pm) => pm.unit_id);
    const { data: inviteUnits } = await admin
      .from("units")
      .select("id, name, leader_id")
      .in("id", unitIds);

    if (inviteUnits && inviteUnits.length > 0) {
      const leaderIds = inviteUnits.map((u) => u.leader_id);
      const { data: leaders } = await admin
        .from("users")
        .select("id, name")
        .in("id", leaderIds);

      const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l.name]));

      for (const inviteUnit of inviteUnits) {
        pendingInvites.push({
          unit_id: inviteUnit.id,
          team_name: inviteUnit.name,
          leader_name: leaderMap.get(inviteUnit.leader_id) ?? "Someone",
        });
      }
    }
  }

  return NextResponse.json({ invites: pendingInvites });
}
