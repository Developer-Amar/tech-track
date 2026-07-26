import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// In-memory active device tracking per (unit_id, checkpoint_id)
// Structure: Map<`${unitId}_${checkpointId}`, { sessionToken: string, userName: string, lastHeartbeat: number }>
const activeDeviceMap = new Map<string, { sessionToken: string; userName: string; lastHeartbeat: number }>();

/**
 * POST /api/event/proctor/report
 *
 * Proctoring reporting API:
 * Handles:
 * - action: "register_device" | "heartbeat" | "report_strike" | "paste_detected"
 * - event_type: "tab_switch" | "focus_loss" | "paste_detected"
 * - Enforces single active device per team per round.
 * - Increments tab_switches/focus loss count, flags staff, locks unit if limit hit.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    round: number;
    action?: string;
    event_type?: string;
    session_token?: string;
    detail?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get user profile name
  const { data: profile } = await admin
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const userName = profile?.name ?? "Team Member";

  // Get user's active unit
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "No unit" }, { status: 400 });

  // Get checkpoint
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", body.round)
    .single();

  if (!checkpoint) return NextResponse.json({ error: "Invalid round" }, { status: 400 });

  const deviceKey = `${membership.unit_id}_${checkpoint.id}`;
  const now = Date.now();

  // ── 1. Single Active Device Lock Check ─────────────────────────────────
  if (body.action === "register_device" || body.action === "heartbeat") {
    const existing = activeDeviceMap.get(deviceKey);
    const sessionToken = body.session_token ?? "token_default";

    // Expire heartbeat after 45 seconds of inactivity
    if (existing && existing.sessionToken !== sessionToken && now - existing.lastHeartbeat < 45000) {
      return NextResponse.json({
        active_device_blocked: true,
        active_user_name: existing.userName,
        message: `Access Blocked: ${existing.userName} is currently active on another device for your team.`,
      });
    }

    // Register/update device session
    activeDeviceMap.set(deviceKey, {
      sessionToken,
      userName,
      lastHeartbeat: now,
    });

    // Return current proctoring state
    const { data: state } = await admin
      .from("proctoring_state")
      .select("*")
      .eq("unit_id", membership.unit_id)
      .eq("checkpoint_id", checkpoint.id)
      .maybeSingle();

    return NextResponse.json({
      active_device_blocked: false,
      tab_switches: state?.tab_switches ?? 0,
      tab_switch_limit: state?.tab_switch_limit ?? 3,
      locked_out: state?.locked_out ?? false,
      remaining: Math.max(0, (state?.tab_switch_limit ?? 3) - (state?.tab_switches ?? 0)),
    });
  }

  // ── 2. Report Proctor Strike (tab_switch, focus_loss, paste) ───────────
  let { data: state } = await admin
    .from("proctoring_state")
    .select("*")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  const eventType = body.event_type || "tab_switch";

  if (!state) {
    const { data: created } = await admin
      .from("proctoring_state")
      .insert({
        unit_id: membership.unit_id,
        checkpoint_id: checkpoint.id,
        tab_switches: 1,
        flagged_at: new Date().toISOString(),
      })
      .select()
      .single();
    state = created;
  } else {
    const newCount = state.tab_switches + 1;
    const updates: Record<string, unknown> = { tab_switches: newCount };

    if (!state.flagged_at) {
      updates.flagged_at = new Date().toISOString();
    }

    if (newCount >= state.tab_switch_limit) {
      updates.locked_out = true;
    }

    const { data: updated } = await admin
      .from("proctoring_state")
      .update(updates)
      .eq("id", state.id)
      .select()
      .single();
    state = updated;
  }

  // Record detailed entry in proctoring_events audit table
  await admin.from("proctoring_events").insert({
    unit_id: membership.unit_id,
    checkpoint_id: checkpoint.id,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
  });

  return NextResponse.json({
    unit_id: membership.unit_id,
    tab_switches: state?.tab_switches ?? 0,
    tab_switch_limit: state?.tab_switch_limit ?? 3,
    locked_out: state?.locked_out ?? false,
    remaining: Math.max(0, (state?.tab_switch_limit ?? 3) - (state?.tab_switches ?? 0)),
    event_type: eventType,
  });
}

/**
 * GET /api/event/proctor/report
 * Returns current proctoring state for user's unit + round.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const round = searchParams.get("round");

  if (!round) return NextResponse.json({ error: "round required" }, { status: 400 });

  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ tab_switches: 0, tab_switch_limit: 3, locked_out: false, remaining: 3, unit_id: null });
  }

  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", parseInt(round))
    .single();

  if (!checkpoint) {
    return NextResponse.json({ tab_switches: 0, tab_switch_limit: 3, locked_out: false, remaining: 3, unit_id: membership.unit_id });
  }

  const { data: state } = await admin
    .from("proctoring_state")
    .select("*")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  return NextResponse.json({
    unit_id: membership.unit_id,
    tab_switches: state?.tab_switches ?? 0,
    tab_switch_limit: state?.tab_switch_limit ?? 3,
    locked_out: state?.locked_out ?? false,
    remaining: Math.max(0, (state?.tab_switch_limit ?? 3) - (state?.tab_switches ?? 0)),
  });
}
