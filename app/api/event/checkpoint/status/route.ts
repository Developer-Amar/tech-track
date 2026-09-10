import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/event/checkpoint/status?round=X
 *
 * Lightweight real-time polling endpoint for participant devices.
 * Checks whether the physical checkpoint for the given round has been
 * verified by outpost staff or an admin.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get user's unit membership
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "User not registered in any unit" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const roundParam = searchParams.get("round");

  if (!roundParam) {
    return NextResponse.json(
      { error: "round parameter required" },
      { status: 400 }
    );
  }

  const round = parseInt(roundParam, 10);
  if (isNaN(round)) {
    return NextResponse.json(
      { error: "Invalid round parameter" },
      { status: 400 }
    );
  }

  // Get checkpoint for this round
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id, location_name")
    .eq("round_number", round)
    .maybeSingle();

  if (!checkpoint) {
    return NextResponse.json(
      { error: "Checkpoint not found for this round" },
      { status: 404 }
    );
  }

  // Check round_progress for this unit and checkpoint
  const { data: progress } = await admin
    .from("round_progress")
    .select("status, points")
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();

  const isVerified =
    progress?.status === "checkpoint_done" ||
    progress?.status === "passed" ||
    progress?.status === "skipped";

  return NextResponse.json({
    round,
    checkpoint_id: checkpoint.id,
    location_name: checkpoint.location_name,
    verified: isVerified,
    status: progress?.status ?? "pending",
  });
}
