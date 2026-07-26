import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/event/riddle/check
 *
 * Checks the riddle answer for the current round.
 * The answer is the checkpoint's location_name (case-insensitive).
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
    .select("event_live, total_rounds")
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
  let body: { answer?: string; round?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { answer, round } = body;
  if (!answer || !round) {
    return NextResponse.json({ error: "answer and round are required." }, { status: 400 });
  }

  // ── Get the checkpoint for this round ─────────────────────────────────
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id, location_name")
    .eq("round_number", round)
    .single();

  if (!checkpoint) {
    return NextResponse.json({ error: "Invalid round." }, { status: 400 });
  }

  // ── Check answer (location_name, case-insensitive, trimmed) ───────────
  const correct =
    answer.trim().toLowerCase() === checkpoint.location_name.trim().toLowerCase();

  if (!correct) {
    return NextResponse.json({ correct: false, message: "Incorrect. Try again!" });
  }

  // ── Create/update round_progress ──────────────────────────────────────
  // Check if a progress row already exists
  const { data: existing } = await admin
    .from("round_progress")
    .select("id")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  if (!existing) {
    await admin.from("round_progress").insert({
      unit_id: membership.unit_id,
      checkpoint_id: checkpoint.id,
      status: "riddle_done",
      points: 10,
    });
  }

  return NextResponse.json({
    correct: true,
    location_name: checkpoint.location_name,
    message: `Correct! Head to: ${checkpoint.location_name}`,
  });
}
