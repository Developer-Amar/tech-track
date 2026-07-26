import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isChitkaraEmail } from "@/lib/validation";

/**
 * POST /api/units/team
 *
 * Creates a team unit with the current user as leader and sends invites
 * to 1–3 members by email. All emails must be @chitkara.edu.in and the
 * invitees must already have signed up (have a row in public.users).
 *
 * Uses the admin client for all DB operations — auth is validated via
 * supabase.auth.getUser() first.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { team_name?: string; member_emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { team_name, member_emails } = body;

  // ── Validate inputs ───────────────────────────────────────────────────
  if (!team_name?.trim()) {
    return NextResponse.json({ error: "Team name is required." }, { status: 400 });
  }

  if (!member_emails || !Array.isArray(member_emails) || member_emails.length < 1 || member_emails.length > 3) {
    return NextResponse.json(
      { error: "You must invite 1 to 3 members." },
      { status: 400 }
    );
  }

  // Normalize and validate emails
  const normalizedEmails = member_emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (normalizedEmails.length < 1) {
    return NextResponse.json({ error: "At least one member email is required." }, { status: 400 });
  }

  // Check for duplicates
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    return NextResponse.json({ error: "Duplicate member emails." }, { status: 400 });
  }

  // No self-invite
  if (normalizedEmails.includes(user.email!.toLowerCase())) {
    return NextResponse.json({ error: "You can't invite yourself." }, { status: 400 });
  }

  // All must be chitkara.edu.in
  for (const email of normalizedEmails) {
    if (!isChitkaraEmail(email)) {
      return NextResponse.json(
        { error: `${email} is not a chitkara.edu.in address.` },
        { status: 400 }
      );
    }
  }

  const adminSupabase = createAdminClient();

  // ── Check registration is open ────────────────────────────────────────
  const { data: settings } = await adminSupabase
    .from("event_settings")
    .select("registration_open")
    .eq("id", 1)
    .single();

  if (!settings?.registration_open) {
    return NextResponse.json({ error: "Registration is closed." }, { status: 400 });
  }

  // ── Check leader doesn't already have a unit ──────────────────────────
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

  // ── Resolve invitee emails to user IDs (must already be registered) ───
  const invitees: { user_id: string; email: string }[] = [];

  for (const email of normalizedEmails) {
    const { data: inviteeUser } = await adminSupabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!inviteeUser) {
      return NextResponse.json(
        { error: `${email} hasn't signed up yet. Ask them to sign in first, then try again.` },
        { status: 400 }
      );
    }

    // Check invitee isn't already locked (accepted member of any unit)
    const { data: inviteeExisting } = await adminSupabase
      .from("unit_members")
      .select("id")
      .eq("user_id", inviteeUser.id)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();

    if (inviteeExisting) {
      return NextResponse.json(
        { error: `${email} is already part of another team or locked as solo.` },
        { status: 400 }
      );
    }

    // Check invitee doesn't already have a pending invite elsewhere
    const { data: pendingInvite } = await adminSupabase
      .from("unit_members")
      .select("id")
      .eq("user_id", inviteeUser.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (pendingInvite) {
      return NextResponse.json(
        { error: `${email} already has a pending invite from another team.` },
        { status: 400 }
      );
    }

    invitees.push({ user_id: inviteeUser.id, email });
  }

  // ── Create the team unit ──────────────────────────────────────────────
  const { data: unit, error: unitError } = await adminSupabase
    .from("units")
    .insert({
      unit_type: "team",
      name: team_name.trim(),
      leader_id: user.id,
      locked: false,
    })
    .select("id")
    .single();

  if (unitError) {
    console.error("Failed to create team:", unitError.message);
    return NextResponse.json(
      { error: "Failed to create team. Please try again." },
      { status: 500 }
    );
  }

  // ── Add leader as accepted member ─────────────────────────────────────
  const { error: leaderError } = await adminSupabase
    .from("unit_members")
    .insert({
      unit_id: unit.id,
      user_id: user.id,
      status: "accepted",
      responded_at: new Date().toISOString(),
    });

  if (leaderError) {
    console.error("Failed to add leader as member:", leaderError.message);
  }

  // ── Send invites ──────────────────────────────────────────────────────
  for (const invitee of invitees) {
    const { error: inviteError } = await adminSupabase
      .from("unit_members")
      .insert({
        unit_id: unit.id,
        user_id: invitee.user_id,
        status: "pending",
      });

    if (inviteError) {
      console.error(`Failed to invite ${invitee.email}:`, inviteError.message);
    }
  }

  return NextResponse.json({ success: true, unit_id: unit.id });
}
