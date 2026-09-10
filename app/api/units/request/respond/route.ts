import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/units/request/respond — Leader accepts or declines a join request
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { unit_id?: string; user_id?: string; response?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.unit_id || !body.user_id || !body.response) {
    return NextResponse.json({ error: "unit_id, user_id, and response required." }, { status: 400 });
  }

  if (body.response !== 'accepted' && body.response !== 'declined') {
    return NextResponse.json({ error: "Response must be 'accepted' or 'declined'." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify caller is the team leader
  const { data: unit } = await admin.from("units").select("leader_id").eq("id", body.unit_id).single();
  if (!unit || unit.leader_id !== user.id) {
    return NextResponse.json({ error: "Only the team leader can respond to join requests." }, { status: 403 });
  }

  // Verify the request exists with 'requested' status
  const { data: joinRequest } = await admin.from("unit_members").select("id").eq("unit_id", body.unit_id).eq("user_id", body.user_id).eq("status", "requested").maybeSingle();
  if (!joinRequest) return NextResponse.json({ error: "No pending join request found." }, { status: 404 });

  if (body.response === 'accepted') {
    // Check team isn't full
    const { data: members } = await admin.from("unit_members").select("id").eq("unit_id", body.unit_id).eq("status", "accepted");
    if ((members?.length ?? 0) >= 4) return NextResponse.json({ error: "Team is full (4 members max)." }, { status: 400 });

    // Check user isn't already accepted elsewhere
    const { data: otherTeam } = await admin.from("unit_members").select("id").eq("user_id", body.user_id).eq("status", "accepted").maybeSingle();
    if (otherTeam) return NextResponse.json({ error: "User has already joined another team." }, { status: 400 });
  }

  // Update the request
  await admin.from("unit_members").update({
    status: body.response,
    responded_at: new Date().toISOString(),
  }).eq("unit_id", body.unit_id).eq("user_id", body.user_id).eq("status", "requested");

  // If accepted, decline all other pending invites/requests for this user
  if (body.response === 'accepted') {
    await admin.from("unit_members").update({
      status: "declined",
      responded_at: new Date().toISOString(),
    }).eq("user_id", body.user_id).in("status", ["pending", "requested"]).neq("unit_id", body.unit_id);
  }

  return NextResponse.json({ success: true });
}
