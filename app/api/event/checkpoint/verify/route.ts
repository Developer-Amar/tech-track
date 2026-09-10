import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/event/checkpoint/verify
 *
 * Verifies the secret code entered at the physical checkpoint.
 * Each unit has a unique code per checkpoint (generated at registration close).
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── Verify event is live ──────────────────────────────────────────────
  const { data: settings } = await admin
    .from("event_settings")
    .select("event_live")
    .eq("id", 1)
    .single();

  if (!settings?.event_live) {
    return NextResponse.json({ error: "Event is not live." }, { status: 400 });
  }

  // ── Get user's unit ───────────────────────────────────────────────────
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "You're not registered." }, { status: 400 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { code?: string; round?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, round } = body;
  if (!code || !round) {
    return NextResponse.json({ error: "code and round are required." }, { status: 400 });
  }

  // ── Get the checkpoint for this round ─────────────────────────────────
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", round)
    .single();

  if (!checkpoint) {
    return NextResponse.json({ error: "Invalid round." }, { status: 400 });
  }

  // ── Look up the unit's code for this checkpoint ───────────────────────
  const { data: unitCode } = await admin
    .from("unit_checkpoint_codes")
    .select("secret_code")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  if (!unitCode) {
    return NextResponse.json(
      { error: "No code found. Registration may not have been finalized." },
      { status: 400 }
    );
  }

  // ── Compare codes (case-insensitive, trimmed) ─────────────────────────
  const correct =
    code.trim().toLowerCase() === unitCode.secret_code.trim().toLowerCase();

  if (!correct) {
    return NextResponse.json({ correct: false, message: "Wrong code. Check the checkpoint again." });
  }

  // ── Update round_progress — mark checkpoint reached ───────────────────
  const { data: progress } = await admin
    .from("round_progress")
    .select("id, status, points")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  // If already at or past checkpoint_done, don't overwrite
  if (progress) {
    if (progress.status === "passed" || progress.status === "skipped") {
      return NextResponse.json({
        correct: true,
        message: "Round already completed!",
      });
    }
    if (progress.status === "checkpoint_done") {
      return NextResponse.json({
        correct: true,
        message: "Checkpoint already verified! Proceed to the coding challenge.",
      });
    }
  }

  // Must have solved the riddle first
  if (!progress || progress.status !== "riddle_done") {
    return NextResponse.json(
      { error: "You must solve the riddle first before verifying the checkpoint." },
      { status: 400 }
    );
  }

  // Mark checkpoint as verified: status → checkpoint_done, points = 20 (riddle + checkpoint)
  const { error: updateError } = await admin
    .from("round_progress")
    .update({ status: "checkpoint_done", points: 20 })
    .eq("id", progress.id);

  if (updateError) {
    console.error("Failed to update checkpoint progress:", updateError.message);
    return NextResponse.json(
      { error: "Failed to update progress in database: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ correct: true, message: "Code verified! Proceed to the coding challenge." });
}
