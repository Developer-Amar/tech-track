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

  const leaderIds = Array.from(new Set(units.map((u) => u.leader_id)));
  const unitIds = units.map((u) => u.id);

  // Batch fetch all leaders and all completed progress in parallel (2 total queries instead of 2*N)
  const [{ data: leaders }, { data: allProgress }] = await Promise.all([
    admin.from("users").select("id, name").in("id", leaderIds),
    admin
      .from("round_progress")
      .select("unit_id, status, points, completed_at")
      .in("unit_id", unitIds)
      .in("status", ["passed", "skipped"])
      .order("completed_at", { ascending: false }),
  ]);

  const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l.name]));

  // Group progress by unit_id
  const progressByUnit = new Map<
    string,
    Array<{ status: string; points: number; completed_at: string | null }>
  >();
  for (const p of allProgress ?? []) {
    let list = progressByUnit.get(p.unit_id);
    if (!list) {
      list = [];
      progressByUnit.set(p.unit_id, list);
    }
    list.push(p);
  }

  const leaderboard = units.map((unit) => {
    const progress = progressByUnit.get(unit.id) ?? [];
    const roundsCompleted = progress.length;
    const totalPoints = progress.reduce((sum, p) => sum + (p.points ?? 0), 0);
    const lastCompletedAt = progress[0]?.completed_at ?? null;

    return {
      unit_id: unit.id,
      name: unit.name || leaderMap.get(unit.leader_id) || "Unknown Team",
      unit_type: unit.unit_type,
      rounds_completed: roundsCompleted,
      total_points: totalPoints,
      last_completed_at: lastCompletedAt,
    };
  });

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

  return NextResponse.json(
    { leaderboard: ranked },
    {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    }
  );
}
