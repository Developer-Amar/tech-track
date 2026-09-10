import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isChitkaraEmail } from "@/lib/validation";

type ManageAction =
  | { action: "invite_member"; email: string }
  | { action: "remove_member"; user_id: string }
  | { action: "cancel_invite"; user_id: string };

/**
 * POST /api/units/manage — Leader manages their own team (pre-lock only)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: ManageAction;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check registration is open
  const { data: settings } = await admin.from("event_settings").select("registration_open").eq("id", 1).single();
  if (!settings?.registration_open) return NextResponse.json({ error: "Registration is closed. No changes allowed." }, { status: 400 });

  // Find the user's team where they are the leader
  const { data: leaderUnit } = await admin.from("units").select("id, locked").eq("leader_id", user.id).maybeSingle();
  if (!leaderUnit) return NextResponse.json({ error: "You are not a team leader." }, { status: 403 });
  if (leaderUnit.locked) return NextResponse.json({ error: "Team is locked. No changes allowed." }, { status: 400 });

  switch (body.action) {
    case "invite_member": {
      const email = body.email?.trim().toLowerCase();
      if (!email || !isChitkaraEmail(email)) {
        return NextResponse.json({ error: "Valid chitkara.edu.in email required." }, { status: 400 });
      }
      if (email === user.email?.toLowerCase()) {
        return NextResponse.json({ error: "You can't invite yourself." }, { status: 400 });
      }

      // Check team size (accepted + pending < 4)
      const { data: currentMembers } = await admin.from("unit_members").select("id").eq("unit_id", leaderUnit.id).in("status", ["accepted", "pending"]);
      if ((currentMembers?.length ?? 0) >= 4) return NextResponse.json({ error: "Team is full (4 max including pending invites)." }, { status: 400 });

      // Find invitee
      const { data: invitee } = await admin.from("users").select("id").eq("email", email).maybeSingle();
      if (!invitee) return NextResponse.json({ error: `${email} hasn't signed up yet.` }, { status: 400 });

      // Check invitee isn't already in a team
      const { data: inviteeTeam } = await admin.from("unit_members").select("id").eq("user_id", invitee.id).eq("status", "accepted").maybeSingle();
      if (inviteeTeam) return NextResponse.json({ error: `${email} is already in a team.` }, { status: 400 });

      const { error: inviteError } = await admin.from("unit_members").upsert({
        unit_id: leaderUnit.id,
        user_id: invitee.id,
        status: "pending",
      }, { onConflict: "unit_id,user_id" });

      if (inviteError) {
        return NextResponse.json({ error: "Failed to send invite." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `Invite sent to ${email}.` });
    }

    case "remove_member": {
      if (!body.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
      if (body.user_id === user.id) return NextResponse.json({ error: "You can't remove yourself. Transfer leadership first." }, { status: 400 });

      await admin.from("unit_members").delete().eq("unit_id", leaderUnit.id).eq("user_id", body.user_id);
      return NextResponse.json({ success: true, message: "Member removed." });
    }

    case "cancel_invite": {
      if (!body.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
      await admin.from("unit_members").delete().eq("unit_id", leaderUnit.id).eq("user_id", body.user_id).in("status", ["pending"]);
      return NextResponse.json({ success: true, message: "Invite cancelled." });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
