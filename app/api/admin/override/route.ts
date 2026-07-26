import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { setIDESmartSetting } from "@/lib/ide-settings";

type OverrideAction =
  | { action: "reopen_registration" }
  | { action: "toggle_event_live" }
  | { action: "unlock_unit"; unit_id: string }
  | { action: "delete_unit"; unit_id: string }
  | { action: "disqualify_unit"; unit_id: string; reason: string }
  | { action: "reinstate_unit"; unit_id: string }
  | { action: "remove_member"; unit_id: string; user_id: string }
  | { action: "reset_all_registrations" }
  | { action: "reset_tab_switches"; unit_id?: string }
  | { action: "set_tab_switch_limit"; limit: number; unit_id?: string }
  | { action: "toggle_ide_smart_features"; enabled: boolean };

/**
 * POST /api/admin/override
 *
 * Super Admin override controls — emergency safety features.
 * Only accessible by super_admin role.
 *
 * Actions:
 * - reopen_registration: reopens registration (reverses close)
 * - toggle_event_live: toggles event_live flag
 * - unlock_unit: unlocks a specific unit
 * - delete_unit: deletes a unit and all its members
 * - disqualify_unit: marks a unit as disqualified
 * - reinstate_unit: removes disqualification
 * - remove_member: removes a member from a unit
 * - reset_all_registrations: nuclear option — deletes ALL units/members/codes
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Super Admin only ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
  }

  let body: OverrideAction;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (body.action) {
    // ── Reopen registration ───────────────────────────────────────────
    case "reopen_registration": {
      await admin
        .from("event_settings")
        .update({ registration_open: true })
        .eq("id", 1);

      // Unlock all units so people can modify rosters again
      await admin
        .from("units")
        .update({ locked: false, locked_at: null })
        .eq("locked", true);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "reopen_registration",
        action_detail: { timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, message: "Registration reopened. All units unlocked." });
    }

    // ── Toggle event live ─────────────────────────────────────────────
    case "toggle_event_live": {
      const { data: settings } = await admin
        .from("event_settings")
        .select("event_live")
        .eq("id", 1)
        .single();

      const newValue = !settings?.event_live;
      await admin
        .from("event_settings")
        .update({ event_live: newValue })
        .eq("id", 1);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: newValue ? "start_event" : "stop_event",
        action_detail: { timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, message: `Event is now ${newValue ? "LIVE" : "stopped"}.` });
    }

    // ── Unlock a unit ─────────────────────────────────────────────────
    case "unlock_unit": {
      if (!body.unit_id) {
        return NextResponse.json({ error: "unit_id required" }, { status: 400 });
      }

      await admin
        .from("units")
        .update({ locked: false, locked_at: null })
        .eq("id", body.unit_id);

      // Also reset any proctoring lockouts to ensure they can actually access the page
      await admin
        .from("proctoring_state")
        .update({ locked_out: false, tab_switches: 0, flagged_at: null })
        .eq("unit_id", body.unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "unlock_unit",
        action_detail: { unit_id: body.unit_id },
      });

      return NextResponse.json({ success: true, message: "Unit unlocked." });
    }

    // ── Delete a unit ─────────────────────────────────────────────────
    case "delete_unit": {
      if (!body.unit_id) {
        return NextResponse.json({ error: "unit_id required" }, { status: 400 });
      }

      // Unlock first to avoid the trigger blocking deletes
      await admin.from("units").update({ locked: false, locked_at: null }).eq("id", body.unit_id);

      await admin.from("unit_checkpoint_codes").delete().eq("unit_id", body.unit_id);
      await admin.from("round_progress").delete().eq("unit_id", body.unit_id);
      await admin.from("submissions").delete().eq("unit_id", body.unit_id);
      await admin.from("proctoring_events").delete().eq("unit_id", body.unit_id);
      await admin.from("notifications").delete().eq("unit_id", body.unit_id);
      await admin.from("unit_members").delete().eq("unit_id", body.unit_id);
      await admin.from("units").delete().eq("id", body.unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "delete_unit",
        action_detail: { unit_id: body.unit_id },
      });

      return NextResponse.json({ success: true, message: "Unit deleted." });
    }

    // ── Disqualify a unit ─────────────────────────────────────────────
    case "disqualify_unit": {
      if (!body.unit_id) {
        return NextResponse.json({ error: "unit_id required" }, { status: 400 });
      }

      await admin
        .from("units")
        .update({
          disqualified: true,
          disqualified_reason: body.reason || "Disqualified by Super Admin",
          disqualified_at: new Date().toISOString(),
        })
        .eq("id", body.unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "disqualify_unit",
        action_detail: { unit_id: body.unit_id, reason: body.reason },
      });

      return NextResponse.json({ success: true, message: "Unit disqualified." });
    }

    // ── Reinstate a unit ──────────────────────────────────────────────
    case "reinstate_unit": {
      if (!body.unit_id) {
        return NextResponse.json({ error: "unit_id required" }, { status: 400 });
      }

      await admin
        .from("units")
        .update({
          disqualified: false,
          disqualified_reason: null,
          disqualified_at: null,
        })
        .eq("id", body.unit_id);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "reinstate_unit",
        action_detail: { unit_id: body.unit_id },
      });

      return NextResponse.json({ success: true, message: "Unit reinstated." });
    }

    // ── Remove a member ───────────────────────────────────────────────
    case "remove_member": {
      if (!body.unit_id || !body.user_id) {
        return NextResponse.json({ error: "unit_id and user_id required" }, { status: 400 });
      }

      // Temporarily unlock the unit to allow member removal
      const { data: memberUnit } = await admin.from("units").select("locked").eq("id", body.unit_id).single();
      if (memberUnit?.locked) {
        await admin.from("units").update({ locked: false }).eq("id", body.unit_id);
      }

      await admin
        .from("unit_members")
        .delete()
        .eq("unit_id", body.unit_id)
        .eq("user_id", body.user_id);

      // Re-lock if it was locked before
      if (memberUnit?.locked) {
        await admin.from("units").update({ locked: true }).eq("id", body.unit_id);
      }

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "remove_member",
        action_detail: { unit_id: body.unit_id, user_id: body.user_id },
      });

      return NextResponse.json({ success: true, message: "Member removed." });
    }

    // ── Nuclear: reset all registrations ──────────────────────────────
    case "reset_all_registrations": {
      // Unlock all units first to avoid trigger blocking deletes
      await admin.from("units").update({ locked: false, locked_at: null }).neq("id", "00000000-0000-0000-0000-000000000000");

      await admin.from("unit_checkpoint_codes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("round_progress").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("proctoring_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("unit_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("units").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      await admin
        .from("event_settings")
        .update({ registration_open: true, event_live: false })
        .eq("id", 1);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "reset_all_registrations",
        action_detail: { timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, message: "All registrations wiped. Registration reopened." });
    }

    case "reset_tab_switches": {
      const rtBody = body as { unit_id?: string };
      let query = admin.from("proctoring_state").update({ tab_switches: 0, locked_out: false, flagged_at: null });
      if (rtBody.unit_id) query = query.eq("unit_id", rtBody.unit_id);
      await query;

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "reset_tab_switches",
        action_detail: { unit_id: rtBody.unit_id || "all" },
      });

      return NextResponse.json({ success: true, message: rtBody.unit_id ? "Tab switches reset for unit." : "Tab switches reset for all units." });
    }

    case "set_tab_switch_limit": {
      const slBody = body as { limit: number; unit_id?: string };
      if (!slBody.limit || slBody.limit < 1) {
        return NextResponse.json({ error: "Limit must be >= 1" }, { status: 400 });
      }
      let slQuery = admin.from("proctoring_state").update({ tab_switch_limit: slBody.limit });
      if (slBody.unit_id) slQuery = slQuery.eq("unit_id", slBody.unit_id);
      await slQuery;

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "set_tab_switch_limit",
        action_detail: { limit: slBody.limit, unit_id: slBody.unit_id || "all" },
      });

      return NextResponse.json({ success: true, message: `Tab switch limit set to ${slBody.limit}.` });
    }

    case "toggle_ide_smart_features": {
      const isfBody = body as { enabled: boolean };
      await setIDESmartSetting(isfBody.enabled, user.id);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: "toggle_ide_smart_features",
        action_detail: { enabled: isfBody.enabled },
      });

      return NextResponse.json({ success: true, message: `IDE smart features are now ${isfBody.enabled ? "enabled" : "disabled"}.` });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
