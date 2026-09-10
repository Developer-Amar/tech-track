import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type RoundAction =
  | { action: "stop_round_1" }
  | { action: "start_round_2" }
  | { action: "stop_round_2" }
  | { action: "qualify_teams"; unit_ids: string[] }
  | { action: "remove_qualifier"; unit_id: string }
  | { action: "add_back_entry"; unit_id: string };

/**
 * GET /api/admin/rounds — Returns round state, qualifiers, Round 2 problems
 * POST /api/admin/rounds — Manage round transitions and team qualifications
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin.from("event_settings").select("*").eq("id", 1).single();
  const { data: qualifiers } = await admin.from("round_qualifiers").select(`
    id, unit_id, is_back_entry, qualified_at, qualified_by,
    units:unit_id (name)
  `);
  const { data: problems } = await admin.from("round_2_problems").select("*").order("order_index");

  return NextResponse.json({ settings, qualifiers, problems });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: RoundAction | { action: "reopen_round_1" };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (body.action) {
    case "reopen_round_1": {
      await admin.from("event_settings").update({
        round_1_stopped: false,
        event_live: true,
      }).eq("id", 1);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "reopen_round_1",
        action_detail: { timestamp: new Date().toISOString() },
      });
      return NextResponse.json({ success: true, message: "Round 1 reopened. Leaderboard is hidden again." });
    }

    case "stop_round_1": {
      await admin.from("event_settings").update({
        round_1_stopped: true,
        event_live: false,
      }).eq("id", 1);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "stop_round_1",
        action_detail: { timestamp: new Date().toISOString() },
      });
      return NextResponse.json({ success: true, message: "Round 1 stopped. Leaderboard now visible to all." });
    }

    case "start_round_2": {
      await admin.from("event_settings").update({
        current_round_phase: 2,
        round_2_active: true,
        event_live: true,
      }).eq("id", 1);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "start_round_2",
        action_detail: { timestamp: new Date().toISOString() },
      });
      return NextResponse.json({ success: true, message: "Round 2 started for qualified teams." });
    }

    case "stop_round_2": {
      await admin.from("event_settings").update({
        round_2_stopped: true,
        round_2_active: false,
        event_live: false,
      }).eq("id", 1);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "stop_round_2",
        action_detail: { timestamp: new Date().toISOString() },
      });
      return NextResponse.json({ success: true, message: "Round 2 stopped. Final results now visible." });
    }

    case "qualify_teams": {
      if (!body.unit_ids?.length) return NextResponse.json({ error: "unit_ids required" }, { status: 400 });
      const rows = body.unit_ids.map(uid => ({
        unit_id: uid,
        qualified_by: user.id,
        is_back_entry: false,
      }));
      const { error } = await admin.from("round_qualifiers").upsert(rows, { onConflict: "unit_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "qualify_teams",
        action_detail: { unit_ids: body.unit_ids, count: body.unit_ids.length },
      });
      return NextResponse.json({ success: true, message: `${body.unit_ids.length} teams qualified for Round 2.` });
    }

    case "remove_qualifier": {
      if (!body.unit_id) return NextResponse.json({ error: "unit_id required" }, { status: 400 });
      await admin.from("round_qualifiers").delete().eq("unit_id", body.unit_id);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "remove_qualifier",
        action_detail: { unit_id: body.unit_id },
      });
      return NextResponse.json({ success: true, message: "Team removed from Round 2." });
    }

    case "add_back_entry": {
      if (!body.unit_id) return NextResponse.json({ error: "unit_id required" }, { status: 400 });
      const { error } = await admin.from("round_qualifiers").upsert({
        unit_id: body.unit_id,
        qualified_by: user.id,
        is_back_entry: true,
      }, { onConflict: "unit_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "add_back_entry",
        action_detail: { unit_id: body.unit_id },
      });
      return NextResponse.json({ success: true, message: "Team given back entry to Round 2." });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
