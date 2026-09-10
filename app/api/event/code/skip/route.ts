import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/event/code/skip
 *
 * Skips the coding challenge for the current round.
 * Awards 0 points for the code portion. Round advances.
 * Any single team member can trigger this.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { round: number };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get user's unit
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "No unit" }, { status: 400 });

  // Get checkpoint for this round
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", body.round)
    .single();

  if (!checkpoint) return NextResponse.json({ error: "Invalid round" }, { status: 400 });

  // Check round_progress exists and is at checkpoint_done step
  const { data: progress } = await admin
    .from("round_progress")
    .select("id, status, points")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  if (!progress) {
    return NextResponse.json({ error: "Solve the riddle and verify checkpoint first." }, { status: 400 });
  }
  if (progress.status === "passed" || progress.status === "skipped") {
    return NextResponse.json({ error: "Round already completed" }, { status: 400 });
  }
  if (progress.status !== "checkpoint_done") {
    return NextResponse.json(
      { error: "Checkpoint code must be verified at the physical outpost before skipping the coding challenge." },
      { status: 400 }
    );
  }

  // Points earned so far: 10 (riddle) + 10 (checkpoint) = 20, code = 0 (skipped)
  const earnedPoints = 20;

  const { error: updateError } = await admin
    .from("round_progress")
    .update({
      status: "skipped",
      points: earnedPoints,
      completed_at: new Date().toISOString(),
    })
    .eq("id", progress.id);

  if (updateError) {
    console.error("Failed to skip round challenge:", updateError.message);
    return NextResponse.json(
      { error: "Failed to record skip in database: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Challenge skipped. No code points awarded. Moving to next round.",
    points: earnedPoints,
  });
}
