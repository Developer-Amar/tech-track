import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { inspectPastePayload } from "@/lib/proctor/ai-detector";

/**
 * POST /api/event/proctor/report
 *
 * Proctoring reporting & AI Behavioral telemetry API:
 * Handles:
 * - action: "register_device" | "heartbeat" | "report_strike" | "paste_detected"
 * - event_type: "tab_switch" | "focus_loss" | "paste_detected" | "devtools_opened" | "fullscreen_exit"
 * - Enforces single active device per team per round backed by unit_device_sessions table.
 * - Increments tab_switches / strikes, flags staff, locks unit if limit reached.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    round: number;
    action?: string;
    event_type?: string;
    session_token?: string;
    detail?: string;
    snippet?: string;
    char_count?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const roundNumber = Number(body.round) || 1;
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

  // Get checkpoint (optional for Round 2)
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", roundNumber)
    .maybeSingle();

  const checkpointId = checkpoint?.id ?? null;
  const now = new Date();

  // ── 1. Single Active Device Lock (Persistent in DB) ───────────────────
  if (body.action === "register_device" || body.action === "heartbeat") {
    // TT-12: Reject missing, trivial, or default tokens to prevent concurrency bypass
    const rawSessionToken = (body.session_token || "").trim();
    if (
      !rawSessionToken ||
      rawSessionToken === "token_default" ||
      rawSessionToken === "default" ||
      rawSessionToken.length < 8
    ) {
      return NextResponse.json(
        { error: "A valid unique client device session token is required." },
        { status: 400 }
      );
    }
    const sessionToken = rawSessionToken;
    // Check if another device session is active for this unit & round
    const { data: existingSession } = await admin
      .from("unit_device_sessions")
      .select("*")
      .eq("unit_id", membership.unit_id)
      .eq("round_number", roundNumber)
      .maybeSingle();

    if (existingSession) {
      const lastHbTime = new Date(existingSession.last_heartbeat).getTime();
      const isExpired = Date.now() - lastHbTime > 45000; // 45 second heartbeat expiration

      if (!isExpired && existingSession.session_token !== sessionToken) {
        return NextResponse.json({
          active_device_blocked: true,
          active_user_name: existingSession.user_name,
          message: `Access Blocked: ${existingSession.user_name} is currently active on another device for your team.`,
        });
      }
    }

    // Upsert current device session
    await admin.from("unit_device_sessions").upsert(
      {
        unit_id: membership.unit_id,
        round_number: roundNumber,
        user_id: user.id,
        user_name: userName,
        session_token: sessionToken,
        last_heartbeat: now.toISOString(),
      },
      { onConflict: "unit_id,round_number" }
    );

    // Return current proctoring state
    const { data: state } = await admin
      .from("proctoring_state")
      .select("*")
      .eq("unit_id", membership.unit_id)
      .eq("round_number", roundNumber)
      .maybeSingle();

    return NextResponse.json({
      active_device_blocked: false,
      tab_switches: state?.tab_switches ?? 0,
      tab_switch_limit: state?.tab_switch_limit ?? 3,
      locked_out: state?.locked_out ?? false,
      remaining: Math.max(0, (state?.tab_switch_limit ?? 3) - (state?.tab_switches ?? 0)),
    });
  }

  // ── 2. Report Proctor Strike (tab_switch, focus_loss, paste, devtools) ──
  const eventType = body.event_type || "tab_switch";
  let severity = "low";
  const metadata: Record<string, unknown> = {
    reported_by: userName,
    user_id: user.id,
    detail: body.detail,
  };

  let isAiFlag = false;
  if (eventType === "paste_detected" && body.snippet) {
    const pasteAnalysis = inspectPastePayload(body.snippet, body.char_count ?? body.snippet.length);
    metadata.snippet_preview = body.snippet.slice(0, 300);
    metadata.char_count = body.char_count ?? body.snippet.length;
    metadata.ai_suspicion = pasteAnalysis.aiSuspicionScore;
    metadata.tags = pasteAnalysis.tags;

    if (pasteAnalysis.isMajorPaste || pasteAnalysis.aiSuspicionScore >= 50) {
      severity = "high";
      isAiFlag = true;
    } else {
      severity = "medium";
    }
  } else if (eventType === "tab_switch") {
    severity = "medium";
  } else if (eventType === "devtools_opened") {
    severity = "high";
  }

  // Fetch or initialize proctoring state
  const { data: state } = await admin
    .from("proctoring_state")
    .select("*")
    .eq("unit_id", membership.unit_id)
    .eq("round_number", roundNumber)
    .maybeSingle();

  const currentSwitches = state?.tab_switches ?? 0;
  const limit = state?.tab_switch_limit ?? 3;
  const newSwitches = currentSwitches + 1;
  const willLockOut = newSwitches >= limit;
  const currentAiFlags = state?.ai_flags_count ?? 0;
  const newAiFlags = isAiFlag ? currentAiFlags + 1 : currentAiFlags;

  const { data: updatedState, error: stateError } = await admin
    .from("proctoring_state")
    .upsert(
      {
        unit_id: membership.unit_id,
        checkpoint_id: checkpointId,
        round_number: roundNumber,
        tab_switches: newSwitches,
        tab_switch_limit: limit,
        locked_out: willLockOut,
        ai_flags_count: newAiFlags,
        flagged_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "unit_id,round_number" }
    )
    .select()
    .single();

  if (stateError) {
    console.error("Failed to update proctoring_state:", stateError.message);
  }

  // Record rich event in proctoring_events
  await admin.from("proctoring_events").insert({
    unit_id: membership.unit_id,
    checkpoint_id: checkpointId,
    round_number: roundNumber,
    event_type: eventType,
    severity,
    metadata,
    occurred_at: now.toISOString(),
  });

  return NextResponse.json({
    unit_id: membership.unit_id,
    tab_switches: updatedState?.tab_switches ?? newSwitches,
    tab_switch_limit: limit,
    locked_out: updatedState?.locked_out ?? willLockOut,
    remaining: Math.max(0, limit - newSwitches),
    event_type: eventType,
    severity,
    ai_flagged: isAiFlag,
  });
}

/**
 * GET /api/event/proctor/report
 * Returns current proctoring state for user's unit + round.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const round = searchParams.get("round");
  const roundNumber = round ? parseInt(round, 10) : 1;

  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({
      tab_switches: 0,
      tab_switch_limit: 3,
      locked_out: false,
      remaining: 3,
      unit_id: null,
    });
  }

  const { data: state } = await admin
    .from("proctoring_state")
    .select("*")
    .eq("unit_id", membership.unit_id)
    .eq("round_number", roundNumber)
    .maybeSingle();

  return NextResponse.json({
    unit_id: membership.unit_id,
    tab_switches: state?.tab_switches ?? 0,
    tab_switch_limit: state?.tab_switch_limit ?? 3,
    locked_out: state?.locked_out ?? false,
    remaining: Math.max(0, (state?.tab_switch_limit ?? 3) - (state?.tab_switches ?? 0)),
  });
}
