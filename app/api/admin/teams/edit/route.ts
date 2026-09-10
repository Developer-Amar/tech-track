import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type TeamEditAction =
  | { action: "rename_team"; unit_id: string; name: string }
  | { action: "add_member"; unit_id: string; email: string }
  | { action: "remove_member"; unit_id: string; user_id: string }
  | { action: "merge_teams"; source_unit_id: string; target_unit_id: string }
  | { action: "transfer_leadership"; unit_id: string; new_leader_id: string };

/**
 * POST /api/admin/teams/edit — Admin team management
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: TeamEditAction;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (body.action) {
    case "rename_team": {
      if (!body.unit_id || !body.name?.trim()) {
        return NextResponse.json({ error: "unit_id and name required" }, { status: 400 });
      }
      await admin.from("units").update({ name: body.name.trim() }).eq("id", body.unit_id);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "rename_team",
        action_detail: { unit_id: body.unit_id, new_name: body.name.trim() },
      });
      return NextResponse.json({ success: true, message: "Team renamed." });
    }

    case "add_member": {
      if (!body.unit_id || !body.email?.trim()) {
        return NextResponse.json({ error: "unit_id and email required" }, { status: 400 });
      }
      // Find user by email
      const { data: targetUser } = await admin.from("users").select("id").eq("email", body.email.trim().toLowerCase()).maybeSingle();
      if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // Check user isn't already in a team
      const { data: existingMembership } = await admin.from("unit_members").select("id").eq("user_id", targetUser.id).eq("status", "accepted").maybeSingle();
      if (existingMembership) return NextResponse.json({ error: "User is already in a team" }, { status: 400 });

      // Check team isn't at 4 members
      const { data: currentMembers } = await admin.from("unit_members").select("id").eq("unit_id", body.unit_id).eq("status", "accepted");
      if ((currentMembers?.length ?? 0) >= 4) return NextResponse.json({ error: "Team already has 4 members" }, { status: 400 });

      // Temporarily unlock if needed
      const { data: unit } = await admin.from("units").select("locked").eq("id", body.unit_id).single();
      if (unit?.locked) await admin.from("units").update({ locked: false }).eq("id", body.unit_id);

      await admin.from("unit_members").insert({
        unit_id: body.unit_id,
        user_id: targetUser.id,
        status: "accepted",
        responded_at: new Date().toISOString(),
      });

      if (unit?.locked) await admin.from("units").update({ locked: true }).eq("id", body.unit_id);

      // Decline any other pending invites/requests for this user
      await admin.from("unit_members").update({ status: "declined", responded_at: new Date().toISOString() }).eq("user_id", targetUser.id).in("status", ["pending", "requested"]).neq("unit_id", body.unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "admin_add_member",
        action_detail: { unit_id: body.unit_id, user_id: targetUser.id, email: body.email },
      });
      return NextResponse.json({ success: true, message: "Member added to team." });
    }

    case "remove_member": {
      if (!body.unit_id || !body.user_id) {
        return NextResponse.json({ error: "unit_id and user_id required" }, { status: 400 });
      }
      // Temporarily unlock if needed
      const { data: rmUnit } = await admin.from("units").select("locked").eq("id", body.unit_id).single();
      if (rmUnit?.locked) await admin.from("units").update({ locked: false }).eq("id", body.unit_id);

      await admin.from("unit_members").delete().eq("unit_id", body.unit_id).eq("user_id", body.user_id);

      if (rmUnit?.locked) await admin.from("units").update({ locked: true }).eq("id", body.unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "admin_remove_member",
        action_detail: { unit_id: body.unit_id, user_id: body.user_id },
      });
      return NextResponse.json({ success: true, message: "Member removed." });
    }

    case "merge_teams": {
      if (!body.source_unit_id || !body.target_unit_id) {
        return NextResponse.json({ error: "source_unit_id and target_unit_id required" }, { status: 400 });
      }
      if (body.source_unit_id === body.target_unit_id) {
        return NextResponse.json({ error: "Cannot merge a team with itself" }, { status: 400 });
      }

      // Get accepted member counts
      const { data: sourceMembers } = await admin.from("unit_members").select("id, user_id").eq("unit_id", body.source_unit_id).eq("status", "accepted");
      const { data: targetMembers } = await admin.from("unit_members").select("id").eq("unit_id", body.target_unit_id).eq("status", "accepted");

      const combinedCount = (sourceMembers?.length ?? 0) + (targetMembers?.length ?? 0);
      if (combinedCount > 4) {
        return NextResponse.json({ error: `Merge would create a ${combinedCount}-member team. Maximum is 4.` }, { status: 400 });
      }

      // Unlock both units temporarily
      await admin.from("units").update({ locked: false, locked_at: null }).in("id", [body.source_unit_id, body.target_unit_id]);

      // Move accepted members from source to target
      for (const member of sourceMembers ?? []) {
        // Delete from source
        await admin.from("unit_members").delete().eq("unit_id", body.source_unit_id).eq("user_id", member.user_id);
        // Insert into target as accepted
        await admin.from("unit_members").insert({
          unit_id: body.target_unit_id, user_id: member.user_id,
          status: "accepted", responded_at: new Date().toISOString(),
        });
      }

      // Move round_progress from source to target
      await admin.from("round_progress").update({ unit_id: body.target_unit_id }).eq("unit_id", body.source_unit_id);
      // Move submissions
      await admin.from("submissions").update({ unit_id: body.target_unit_id }).eq("unit_id", body.source_unit_id);
      // Move checkpoint codes
      await admin.from("unit_checkpoint_codes").update({ unit_id: body.target_unit_id }).eq("unit_id", body.source_unit_id);

      // Delete remaining source data
      await admin.from("proctoring_events").delete().eq("unit_id", body.source_unit_id);
      await admin.from("proctoring_state").delete().eq("unit_id", body.source_unit_id);
      await admin.from("notifications").delete().eq("unit_id", body.source_unit_id);
      await admin.from("unit_members").delete().eq("unit_id", body.source_unit_id);
      await admin.from("units").delete().eq("id", body.source_unit_id);

      // Re-lock target
      await admin.from("units").update({ locked: true, locked_at: new Date().toISOString() }).eq("id", body.target_unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "merge_teams",
        action_detail: { source_unit_id: body.source_unit_id, target_unit_id: body.target_unit_id, members_moved: sourceMembers?.length ?? 0 },
      });
      return NextResponse.json({ success: true, message: `Teams merged. ${sourceMembers?.length ?? 0} members moved.` });
    }

    case "transfer_leadership": {
      if (!body.unit_id || !body.new_leader_id) {
        return NextResponse.json({ error: "unit_id and new_leader_id required" }, { status: 400 });
      }
      // Verify new leader is an accepted member
      const { data: memberCheck } = await admin.from("unit_members").select("id").eq("unit_id", body.unit_id).eq("user_id", body.new_leader_id).eq("status", "accepted").maybeSingle();
      if (!memberCheck) return NextResponse.json({ error: "User is not an accepted member of this team" }, { status: 400 });

      await admin.from("units").update({ leader_id: body.new_leader_id }).eq("id", body.unit_id);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "transfer_leadership",
        action_detail: { unit_id: body.unit_id, new_leader_id: body.new_leader_id },
      });
      return NextResponse.json({ success: true, message: "Leadership transferred." });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
