import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/units/request — Member sends a join request to an open team
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { unit_id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.unit_id) return NextResponse.json({ error: "unit_id is required" }, { status: 400 });

  const admin = createAdminClient();

  // Check registration is open
  const { data: settings } = await admin.from("event_settings").select("registration_open").eq("id", 1).single();
  if (!settings?.registration_open) return NextResponse.json({ error: "Registration is closed." }, { status: 400 });

  // Check user is not already in a team
  const { data: existing } = await admin.from("unit_members").select("id").eq("user_id", user.id).eq("status", "accepted").maybeSingle();
  if (existing) return NextResponse.json({ error: "You're already part of a team." }, { status: 400 });

  // Check target team exists, is not locked, not disqualified
  const { data: unit } = await admin.from("units").select("id, locked, disqualified").eq("id", body.unit_id).single();
  if (!unit) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (unit.locked) return NextResponse.json({ error: "Team is locked." }, { status: 400 });
  if (unit.disqualified) return NextResponse.json({ error: "Team is disqualified." }, { status: 400 });

  // Check team isn't full (< 4 accepted members)
  const { data: members } = await admin.from("unit_members").select("id").eq("unit_id", body.unit_id).eq("status", "accepted");
  if ((members?.length ?? 0) >= 4) return NextResponse.json({ error: "Team is full." }, { status: 400 });

  // Check no existing pending request or invite for this user to this team
  const { data: existingRequest } = await admin.from("unit_members").select("id, status").eq("unit_id", body.unit_id).eq("user_id", user.id).maybeSingle();
  if (existingRequest) {
    if (existingRequest.status === 'requested') return NextResponse.json({ error: "You already have a pending request to this team." }, { status: 400 });
    if (existingRequest.status === 'pending') return NextResponse.json({ error: "You already have a pending invite from this team." }, { status: 400 });
    if (existingRequest.status === 'accepted') return NextResponse.json({ error: "You're already in this team." }, { status: 400 });
  }

  // Insert join request
  const { error: insertError } = await admin.from("unit_members").insert({
    unit_id: body.unit_id,
    user_id: user.id,
    status: "requested",
  });

  if (insertError) {
    console.error("Join request failed:", insertError.message);
    return NextResponse.json({ error: "Failed to send join request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
