import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/stats
 *
 * Returns aggregate stats for the admin dashboard.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { count: totalUsers } = await admin.from("users").select("id", { count: "exact", head: true });
  const { count: profileComplete } = await admin.from("users").select("id", { count: "exact", head: true }).eq("profile_completed", true);
  const { count: totalUnits } = await admin.from("units").select("id", { count: "exact", head: true });
  const { count: lockedUnits } = await admin.from("units").select("id", { count: "exact", head: true }).eq("locked", true);
  const { count: soloUnits } = await admin.from("units").select("id", { count: "exact", head: true }).eq("unit_type", "solo");
  const { count: teamUnits } = await admin.from("units").select("id", { count: "exact", head: true }).eq("unit_type", "team");
  const { count: totalSubmissions } = await admin.from("submissions").select("id", { count: "exact", head: true });
  const { count: passedSubmissions } = await admin.from("submissions").select("id", { count: "exact", head: true }).eq("passed", true);
  const { count: pendingInvites } = await admin.from("unit_members").select("id", { count: "exact", head: true }).eq("status", "pending");

  // Round completion breakdown
  const { data: progressData } = await admin.from("round_progress").select("checkpoint_id, status");
  const roundsPassed = (progressData ?? []).filter(p => p.status === "passed").length;
  const roundsInProgress = (progressData ?? []).filter(p => p.status === "pending").length;

  const { data: settings } = await admin.from("event_settings").select("*").eq("id", 1).single();

  return NextResponse.json({
    users: { total: totalUsers ?? 0, profile_complete: profileComplete ?? 0 },
    units: { total: totalUnits ?? 0, locked: lockedUnits ?? 0, solo: soloUnits ?? 0, team: teamUnits ?? 0 },
    submissions: { total: totalSubmissions ?? 0, passed: passedSubmissions ?? 0 },
    invites: { pending: pendingInvites ?? 0 },
    rounds: { passed: roundsPassed, in_progress: roundsInProgress },
    settings,
  });
}
