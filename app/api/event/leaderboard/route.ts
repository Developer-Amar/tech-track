import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/event/leaderboard
 *
 * Returns all locked units ranked by:
 * 1. Total points (descending)
 * 2. Rounds completed (descending)
 * 3. Last completion time (ascending — faster is better)
 */
export async function GET() {
  const admin = createAdminClient();

  // Get all locked, non-disqualified units
  const { data: units } = await admin
    .from("units")
    .select("id, name, unit_type, leader_id")
    .eq("locked", true)
    .eq("disqualified", false);

  if (!units || units.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  const leaderboard = [];

  for (const unit of units) {
    // Get leader name for display
    const { data: leader } = await admin
      .from("users")
      .select("name")
      .eq("id", unit.leader_id)
      .single();

    // Get all progress for this unit
    const { data: progress } = await admin
      .from("round_progress")
      .select("status, points, completed_at")
      .eq("unit_id", unit.id)
      .in("status", ["passed", "skipped"])
      .order("completed_at", { ascending: false });

    const roundsCompleted = progress?.length ?? 0;
    const totalPoints = (progress ?? []).reduce((sum, p) => sum + (p.points ?? 0), 0);
    const lastCompletedAt = progress?.[0]?.completed_at ?? null;

    leaderboard.push({
      unit_id: unit.id,
      name: unit.name || leader?.name || "Solo",
      unit_type: unit.unit_type,
      rounds_completed: roundsCompleted,
      total_points: totalPoints,
      last_completed_at: lastCompletedAt,
    });
  }

  // Sort: points desc, then rounds desc, then last_completed_at asc
  leaderboard.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.rounds_completed !== a.rounds_completed) return b.rounds_completed - a.rounds_completed;
    if (a.last_completed_at && b.last_completed_at) {
      return new Date(a.last_completed_at).getTime() - new Date(b.last_completed_at).getTime();
    }
    return a.last_completed_at ? -1 : 1;
  });

  // Add rank
  const ranked = leaderboard.map((entry, i) => ({
    rank: i + 1,
    ...entry,
  }));

  return NextResponse.json({ leaderboard: ranked });
}
