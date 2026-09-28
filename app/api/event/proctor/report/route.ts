import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { inspectPastePayload } from "@/lib/proctor/ai-detector";

/**
 * Robust proctoring state lookup supporting both (unit_id, checkpoint_id)
 * and (unit_id, round_number) unique constraint schemas across databases.
 */
async function getProctorState(
  admin: ReturnType<typeof createAdminClient>,
  unitId: string,
  roundNumber: number,
  checkpointId: string | null
) {
  // 1. Try by round_number first
  const { data: byRound, error: errRound } = await admin
    .from("proctoring_state")
    .select("*")
    .eq("unit_id", unitId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (!errRound && byRound) return byRound;

  // 2. Fallback: try by checkpoint_id
  if (checkpointId) {
    const { data: byCp, error: errCp } = await admin
      .from("proctoring_state")
      .select("*")
      .eq("unit_id", unitId)
      .eq("checkpoint_id", checkpointId)
      .maybeSingle();

    if (!errCp && byCp) return byCp;
  }

  // 3. Fallback: query any state for unit
  const { data: anyState } = await admin
    .from("proctoring_state")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return anyState ?? null;
}

/**
 * Persists strike updates using multi-strategy fallback:
 * 1. Update by PK id (guaranteed to bypass onConflict schema differences)
 * 2. Upsert by (unit_id, round_number)
 * 3. Upsert by (unit_id, checkpoint_id)
 * 4. Plain insert
 */
async function persistProctorStrike(
  admin: ReturnType<typeof createAdminClient>,
  existingState: any,
  unitId: string,
  roundNumber: number,
  checkpointId: string | null,
  newSwitches: number,
  limit: number,
  willLockOut: boolean,
  nowIso: string
) {
  // Strategy 1: Direct update by PK id if existing row was found
  if (existingState?.id) {
    const updatePayload: Record<string, unknown> = {
      tab_switches: newSwitches,
      tab_switch_limit: limit,
      locked_out: willLockOut,
      flagged_at: nowIso,
    };
    if (existingState.round_number === undefined || existingState.round_number === null) {
      updatePayload.round_number = roundNumber;
    }
    if (checkpointId && (existingState.checkpoint_id === undefined || existingState.checkpoint_id === null)) {
      updatePayload.checkpoint_id = checkpointId;
    }

    const { data, error } = await admin
      .from("proctoring_state")
      .update(updatePayload)
      .eq("id", existingState.id)
      .select()
      .single();

    if (!error && data) return data;
    console.error("Direct update by id failed, attempting upsert fallback:", error?.message);
  }

  // Strategy 2: Upsert by (unit_id, round_number)
  const roundPayload: Record<string, unknown> = {
    unit_id: unitId,
    round_number: roundNumber,
    tab_switches: newSwitches,
    tab_switch_limit: limit,
    locked_out: willLockOut,
    flagged_at: nowIso,
  };
  if (checkpointId) roundPayload.checkpoint_id = checkpointId;

  const { data: dataRound, error: errRound } = await admin
    .from("proctoring_state")
    .upsert(roundPayload, { onConflict: "unit_id,round_number" })
    .select()
    .single();

  if (!errRound && dataRound) return dataRound;

  // Strategy 3: Upsert by (unit_id, checkpoint_id)
  if (checkpointId) {
    const cpPayload = {
      unit_id: unitId,
      checkpoint_id: checkpointId,
      tab_switches: newSwitches,
      tab_switch_limit: limit,
      locked_out: willLockOut,
      flagged_at: nowIso,
    };
    const { data: dataCp, error: errCp } = await admin
      .from("proctoring_state")
      .upsert(cpPayload, { onConflict: "unit_id,checkpoint_id" })
      .select()
      .single();

    if (!errCp && dataCp) return dataCp;
  }

  // Strategy 4: Plain insert
  const { data: inserted } = await admin
    .from("proctoring_state")
    .insert({
      unit_id: unitId,
      round_number: roundNumber,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
      tab_switches: newSwitches,
      tab_switch_limit: limit,
      locked_out: willLockOut,
      flagged_at: nowIso,
    })
    .select()
    .single();

  return inserted ?? null;
}

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
    const state = await getProctorState(admin, membership.unit_id, roundNumber, checkpointId);

    return NextResponse.json({
      active_device_blocked: false,
      unit_id: membership.unit_id,
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

  // Fetch current proctoring state (robust multi-field lookup)
  const state = await getProctorState(admin, membership.unit_id, roundNumber, checkpointId);

  const currentSwitches = state?.tab_switches ?? 0;
  const limit = state?.tab_switch_limit ?? 3;
  const newSwitches = currentSwitches + 1;
  const willLockOut = newSwitches >= limit;

  // Persist updated strike count (updates by PK id if existing, avoiding onConflict 42P10 errors)
  const updatedState = await persistProctorStrike(
    admin,
    state,
    membership.unit_id,
    roundNumber,
    checkpointId,
    newSwitches,
    limit,
    willLockOut,
    now.toISOString()
  );

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

  // Look up checkpoint for this round
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", roundNumber)
    .maybeSingle();

  const checkpointId = checkpoint?.id ?? null;

  // Look up proctoring state robustly
  const state = await getProctorState(admin, membership.unit_id, roundNumber, checkpointId);

  return NextResponse.json({
    unit_id: membership.unit_id,
    tab_switches: state?.tab_switches ?? 0,
    tab_switch_limit: state?.tab_switch_limit ?? 3,
    locked_out: state?.locked_out ?? false,
    remaining: Math.max(0, (state?.tab_switch_limit ?? 3) - (state?.tab_switches ?? 0)),
  });
}
