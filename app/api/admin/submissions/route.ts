import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/submissions
 * Returns all code submissions with unit name, round, verdict, and telemetry diagnostics.
 * Supports query params: ?round=1&passed=true&unit_id=xxx
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);

  let query = admin
    .from("submissions")
    .select("id, unit_id, checkpoint_id, code, language, passed, attempt_number, submitted_at, tab_switches, flagged")
    .order("submitted_at", { ascending: false })
    .limit(200);

  const roundParam = searchParams.get("round");
  const passedParam = searchParams.get("passed");
  const unitIdParam = searchParams.get("unit_id");

  if (unitIdParam) query = query.eq("unit_id", unitIdParam);
  if (passedParam) query = query.eq("passed", passedParam === "true");

  const { data: submissions } = await query;
  if (!submissions) return NextResponse.json({ submissions: [] });

  // Get checkpoint round numbers
  const { data: checkpoints } = await admin.from("checkpoints").select("id, round_number, location_name");
  const cpMap = new Map((checkpoints ?? []).map(c => [c.id, c]));

  // Filter by round if needed
  let filtered = submissions;
  if (roundParam) {
    const roundNum = parseInt(roundParam);
    const cpIds = (checkpoints ?? []).filter(c => c.round_number === roundNum).map(c => c.id);
    filtered = submissions.filter(s => cpIds.includes(s.checkpoint_id));
  }

  // Get unit names
  const unitIds = Array.from(new Set(filtered.map(s => s.unit_id)));
  const { data: units } = unitIds.length > 0
    ? await admin.from("units").select("id, name, leader_id").in("id", unitIds)
    : { data: [] };

  const leaderIds = Array.from(new Set((units ?? []).map(u => u.leader_id)));
  const { data: leaders } = leaderIds.length > 0
    ? await admin.from("users").select("id, name").in("id", leaderIds)
    : { data: [] };

  const leaderMap = new Map((leaders ?? []).map(l => [l.id, l.name]));
  const unitMap = new Map((units ?? []).map(u => [u.id, u.name || `Solo — ${leaderMap.get(u.leader_id) ?? "?"}`]));

  // Fetch telemetry logs from audit_log
  const { data: auditLogs } = await admin
    .from("audit_log")
    .select("action_detail, created_at")
    .eq("action_type", "code_submission")
    .order("created_at", { ascending: false })
    .limit(300);

  const auditMap = new Map<string, any>();
  (auditLogs ?? []).forEach(log => {
    if (log.action_detail?.unit_id && log.action_detail?.round) {
      const key = `${log.action_detail.unit_id}_${log.action_detail.round}`;
      if (!auditMap.has(key)) {
        auditMap.set(key, log.action_detail);
      }
    }
  });

  const enriched = filtered.map(s => {
    const roundNum = cpMap.get(s.checkpoint_id)?.round_number ?? 0;
    const key = `${s.unit_id}_${roundNum}`;
    const audit = auditMap.get(key);

    return {
      ...s,
      unit_name: unitMap.get(s.unit_id) ?? "Unknown",
      round_number: roundNum,
      location_name: cpMap.get(s.checkpoint_id)?.location_name ?? "",
      time_taken_seconds: audit?.time_taken_seconds ?? 0,
      paste_count: audit?.paste_count ?? 0,
      keystroke_count: audit?.keystroke_count ?? 0,
    };
  });

  return NextResponse.json({ submissions: enriched });
}
