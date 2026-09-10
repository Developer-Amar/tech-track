import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/proctoring
 *
 * Returns all proctoring states with unit names and alert info.
 * Accessible by admin, super_admin, and checkpoint_staff.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin", "checkpoint_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: states }, { data: events }] = await Promise.all([
    admin
      .from("proctoring_state")
      .select("id, unit_id, checkpoint_id, round_number, tab_switches, tab_switch_limit, locked_out, ai_flags_count, flagged_at, created_at")
      .order("flagged_at", { ascending: false, nullsFirst: false }),
    admin
      .from("proctoring_events")
      .select("id, unit_id, checkpoint_id, round_number, event_type, severity, metadata, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(40),
  ]);

  const allUnitIds = Array.from(
    new Set([
      ...(states ?? []).map((s) => s.unit_id),
      ...(events ?? []).map((e) => e.unit_id),
    ])
  );

  const { data: units } =
    allUnitIds.length > 0
      ? await admin.from("units").select("id, name, leader_id").in("id", allUnitIds)
      : { data: [] };

  const unitMap = new Map<string, { name: string | null; leader_id: string }>(
    (units ?? []).map((u) => [u.id, u])
  );

  const leaderIds = Array.from(
    new Set((units ?? []).filter((u) => !u.name).map((u) => u.leader_id))
  );
  const { data: leaders } =
    leaderIds.length > 0
      ? await admin.from("users").select("id, name").in("id", leaderIds)
      : { data: [] };
  const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l.name]));

  // Checkpoint mapping
  const cpIds = Array.from(
    new Set([
      ...(states ?? []).map((s) => s.checkpoint_id).filter(Boolean),
      ...(events ?? []).map((e) => e.checkpoint_id).filter(Boolean),
    ])
  );
  const { data: checkpoints } =
    cpIds.length > 0
      ? await admin.from("checkpoints").select("id, round_number").in("id", cpIds)
      : { data: [] };
  const cpMap = new Map((checkpoints ?? []).map((c) => [c.id, c.round_number]));

  const alerts = (states ?? []).map((s) => {
    const unit = unitMap.get(s.unit_id);
    const unitName =
      unit?.name || (unit?.leader_id ? leaderMap.get(unit.leader_id) : null) || "Unknown Team";
    return {
      id: s.id,
      unit_id: s.unit_id,
      unit_name: unitName,
      round_number: s.round_number || cpMap.get(s.checkpoint_id) || 1,
      tab_switches: s.tab_switches,
      tab_switch_limit: s.tab_switch_limit,
      locked_out: s.locked_out,
      ai_flags_count: s.ai_flags_count ?? 0,
      flagged_at: s.flagged_at,
    };
  });

  const recentEvents = (events ?? []).map((e) => {
    const unit = unitMap.get(e.unit_id);
    const unitName =
      unit?.name || (unit?.leader_id ? leaderMap.get(unit.leader_id) : null) || "Unknown Team";
    return {
      id: e.id,
      unit_id: e.unit_id,
      unit_name: unitName,
      round_number: e.round_number || cpMap.get(e.checkpoint_id) || 1,
      event_type: e.event_type,
      severity: e.severity || "low",
      metadata: e.metadata || {},
      occurred_at: e.occurred_at,
    };
  });

  return NextResponse.json({ alerts, recent_events: recentEvents });
}
