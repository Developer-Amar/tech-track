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

  const [
    { count: totalUsers },
    { count: profileComplete },
    { count: totalUnits },
    { count: lockedUnits },
    { count: teamUnits },
    { count: totalSubmissions },
    { count: passedSubmissions },
    { count: pendingInvites },
    { data: progressData },
    { data: settings },
  ] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("users").select("id", { count: "exact", head: true }).eq("profile_completed", true),
    admin.from("units").select("id", { count: "exact", head: true }),
    admin.from("units").select("id", { count: "exact", head: true }).eq("locked", true),
    admin.from("units").select("id", { count: "exact", head: true }).eq("unit_type", "team"),
    admin.from("submissions").select("id", { count: "exact", head: true }),
    admin.from("submissions").select("id", { count: "exact", head: true }).eq("passed", true),
    admin.from("unit_members").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("round_progress").select("checkpoint_id, status"),
    admin.from("event_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  // Round completion breakdown
  const roundsPassed = (progressData ?? []).filter(p => p.status === "passed").length;
  const roundsInProgress = (progressData ?? []).filter(p => p.status === "pending").length;

  return NextResponse.json({
    users: { total: totalUsers ?? 0, profile_complete: profileComplete ?? 0 },
    units: { total: totalUnits ?? 0, locked: lockedUnits ?? 0, team: teamUnits ?? 0 },
    submissions: { total: totalSubmissions ?? 0, passed: passedSubmissions ?? 0 },
    invites: { pending: pendingInvites ?? 0 },
    rounds: { passed: roundsPassed, in_progress: roundsInProgress },
    settings,
  });
}
