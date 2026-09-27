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

  // ── Sequence Guard: Previous rounds must be passed or skipped ───────
  if (round > 1) {
    const { data: prevCheckpoints } = await admin
      .from("checkpoints")
      .select("id")
      .lt("round_number", round);
    if (prevCheckpoints && prevCheckpoints.length > 0) {
      const prevIds = prevCheckpoints.map((cp) => cp.id);
      const { count } = await admin
        .from("round_progress")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", membership.unit_id)
        .in("checkpoint_id", prevIds)
        .in("status", ["passed", "skipped"]);
      if ((count ?? 0) < prevIds.length) {
        return NextResponse.json(
          { error: "You must complete previous rounds first." },
          { status: 400 }
        );
      }
    }
  }

  // ── Normalize helper for flexible comparison ─────────────────────────
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s+/g, " ");

  const cleanUserAnswer = answer.trim();
  const normalizedUser = normalize(cleanUserAnswer);

  // ── Retrieve alternate accepted answers from riddles table ─────────────
  let alternateAnswers: string[] = [];
  try {
    const { data: riddle, error: riddleErr } = await admin
      .from("riddles")
      .select("id, alternate_answers")
      .eq("checkpoint_id", checkpoint.id)
      .maybeSingle();

    if (!riddleErr && riddle?.alternate_answers && Array.isArray(riddle.alternate_answers)) {
      alternateAnswers = riddle.alternate_answers;
    }
  } catch (err) {
    console.warn("Could not retrieve alternate_answers for riddle:", err);
  }

  // ── Check answer against location_name AND all alternate answers ──────
  const candidateAnswers = [
    checkpoint.location_name,
    ...alternateAnswers,
  ].filter(Boolean);

  const correct = candidateAnswers.some((candidate) => {
    const rawMatch = candidate.trim().toLowerCase() === cleanUserAnswer.toLowerCase();
    const normMatch = normalize(candidate) === normalizedUser;
    return rawMatch || normMatch;
  });

  if (!correct) {
    return NextResponse.json({ correct: false, message: "Incorrect location answer. Check the riddle or sub-hints and try again!" });
  }

  // ── Create/update round_progress ──────────────────────────────────────
  const { data: existing } = await admin
    .from("round_progress")
    .select("id, status")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  // If already at or past riddle_done, don't overwrite
  if (
    existing &&
    (existing.status === "passed" ||
      existing.status === "skipped" ||
      existing.status === "checkpoint_done" ||
      existing.status === "riddle_done")
  ) {
    return NextResponse.json({
      correct: true,
      location_name: checkpoint.location_name,
      message: `Already solved! Head to: ${checkpoint.location_name}`,
    });
  }

  const { error: upsertError } = await admin.from("round_progress").upsert(
    {
      unit_id: membership.unit_id,
      checkpoint_id: checkpoint.id,
      status: "riddle_done",
      points: 10,
    },
    { onConflict: "unit_id,checkpoint_id" }
  );

  if (upsertError) {
    console.error("Failed to save riddle progress:", upsertError.message);
    return NextResponse.json(
      { error: "Failed to update round progress in database: " + upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    correct: true,
    location_name: checkpoint.location_name,
    message: `Correct! Head to: ${checkpoint.location_name}`,
  });
}
