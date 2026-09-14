import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/leaderboard
 * Admin-only enriched leaderboard with per-round breakdown
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Concurrently fetch all leaderboard data
  const [
    { data: settings },
    { data: units },
    { data: allProgress },
    { data: checkpoints },
    { data: qualifiers },
    { data: r2Progress },
    { data: proctoringState },
  ] = await Promise.all([
    admin.from("event_settings").select("*").eq("id", 1).maybeSingle(),
    admin
      .from("units")
      .select(`
        id, name, leader_id, locked, disqualified, disqualified_reason,
        unit_members (user_id, status, users:user_id (name, email))
      `)
      .eq("locked", true)
      .order("created_at", { ascending: true }),
    admin
      .from("round_progress")
      .select("unit_id, checkpoint_id, status, points, completed_at")
      .order("completed_at", { ascending: true }),
    admin
      .from("checkpoints")
      .select("id, round_number")
      .order("round_number", { ascending: true }),
    admin
      .from("round_qualifiers")
      .select("unit_id, is_back_entry, qualified_at"),
    admin
      .from("round_2_progress")
      .select("unit_id, problem_id, status, points, completed_at"),
    admin
      .from("proctoring_state")
      .select("unit_id, tab_switches, locked_out"),
  ]);

  const checkpointMap = new Map((checkpoints ?? []).map(c => [c.id, c.round_number]));
  const qualifierSet = new Set((qualifiers ?? []).map(q => q.unit_id));
  const qualifierMap = new Map((qualifiers ?? []).map(q => [q.unit_id, q]));
  const proctoringMap = new Map((proctoringState ?? []).map(p => [p.unit_id, p]));

  // Index progress by unit_id for O(1) lookups
  const progressByUnit = new Map<string, any[]>();
  (allProgress ?? []).forEach(p => {
    const list = progressByUnit.get(p.unit_id) ?? [];
    list.push(p);
    progressByUnit.set(p.unit_id, list);
  });

  const r2ProgressByUnit = new Map<string, any[]>();
  (r2Progress ?? []).forEach(p => {
    const list = r2ProgressByUnit.get(p.unit_id) ?? [];
    list.push(p);
    r2ProgressByUnit.set(p.unit_id, list);
  });

  // Build enriched leaderboard
  const leaderboard = (units ?? []).map(unit => {
    const unitProgress = progressByUnit.get(unit.id) ?? [];
    const r1Points = unitProgress.reduce((sum, p) => sum + (p.status === 'passed' || p.status === 'skipped' ? p.points : 0), 0);
    const r1Completed = unitProgress.filter(p => p.status === 'passed' || p.status === 'skipped').length;
    const r1LastCompleted = unitProgress.filter(p => p.completed_at).sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]?.completed_at;

    const unitR2Progress = r2ProgressByUnit.get(unit.id) ?? [];
    const r2Points = unitR2Progress.reduce((sum, p) => sum + (p.status === 'passed' ? p.points : 0), 0);
    const r2Solved = unitR2Progress.filter(p => p.status === 'passed').length;

    const members = (unit.unit_members as any[])?.filter((m: any) => m.status === 'accepted').map((m: any) => (m.users as any)?.name ?? 'Unknown') ?? [];
    const proctoring = proctoringMap.get(unit.id);

    return {
      unit_id: unit.id,
      name: unit.name,
      members,
      disqualified: unit.disqualified,
      disqualified_reason: unit.disqualified_reason,
      qualified_for_round_2: qualifierSet.has(unit.id),
      is_back_entry: qualifierMap.get(unit.id)?.is_back_entry ?? false,
      round_1: {
        total_points: r1Points,
        questions_completed: r1Completed,
        last_completed_at: r1LastCompleted ?? null,
      },
      round_2: {
        total_points: r2Points,
        problems_solved: r2Solved,
      },
      total_points: r1Points + r2Points,
      proctoring: {
        tab_switches: proctoring?.tab_switches ?? 0,
        locked_out: proctoring?.locked_out ?? false,
      },
    };
  });

  // Sort by total points DESC, then r1 completed DESC, then last completed ASC
  leaderboard.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.round_1.questions_completed !== a.round_1.questions_completed) return b.round_1.questions_completed - a.round_1.questions_completed;
    if (!a.round_1.last_completed_at) return 1;
    if (!b.round_1.last_completed_at) return -1;
    return new Date(a.round_1.last_completed_at).getTime() - new Date(b.round_1.last_completed_at).getTime();
  });

  return NextResponse.json({ leaderboard, settings });
}
