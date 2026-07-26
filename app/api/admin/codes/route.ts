import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/codes
 *
 * Returns all unit checkpoint codes mapped to human-readable names.
 * Accessible by admin, super_admin, and checkpoint_staff.
 *
 * - admin/super_admin: sees ALL codes for ALL checkpoints
 * - checkpoint_staff: sees codes only for their assigned checkpoint(s)
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "super_admin", "checkpoint_staff"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = createAdminClient();

  // If checkpoint_staff, get their assigned checkpoint IDs
  let staffCheckpointIds: string[] | null = null;
  if (profile.role === "checkpoint_staff") {
    const { data: assignments } = await admin
      .from("checkpoint_staff_assignments")
      .select("checkpoint_id")
      .eq("user_id", user.id);

    staffCheckpointIds = assignments?.map((a) => a.checkpoint_id) ?? [];
    if (staffCheckpointIds.length === 0) {
      return NextResponse.json({ codes: [], message: "No checkpoint assigned to you." });
    }
  }

  // Fetch all codes
  let query = admin
    .from("unit_checkpoint_codes")
    .select("unit_id, checkpoint_id, secret_code");

  if (staffCheckpointIds) {
    query = query.in("checkpoint_id", staffCheckpointIds);
  }

  const { data: codes } = await query;

  if (!codes || codes.length === 0) {
    return NextResponse.json({ codes: [] });
  }

  // Gather unique IDs for batch lookups
  const unitIds = Array.from(new Set(codes.map((c) => c.unit_id)));
  const checkpointIds = Array.from(new Set(codes.map((c) => c.checkpoint_id)));

  // Fetch unit details
  const { data: units } = await admin
    .from("units")
    .select("id, name, unit_type, leader_id")
    .in("id", unitIds);

  const leaderIds = Array.from(new Set((units ?? []).map((u) => u.leader_id)));
  const { data: leaders } = await admin
    .from("users")
    .select("id, name")
    .in("id", leaderIds);

  const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l.name]));
  const unitMap = new Map(
    (units ?? []).map((u) => [
      u.id,
      {
        name: u.name || `Solo — ${leaderMap.get(u.leader_id) ?? "Unknown"}`,
        unit_type: u.unit_type,
      },
    ])
  );

  // Fetch checkpoint details
  const { data: checkpoints } = await admin
    .from("checkpoints")
    .select("id, location_name, round_number")
    .in("id", checkpointIds);

  const checkpointMap = new Map(
    (checkpoints ?? []).map((cp) => [
      cp.id,
      { location_name: cp.location_name, round_number: cp.round_number },
    ])
  );

  // Build the mapped response
  const mapped = codes.map((c) => ({
    unit_name: unitMap.get(c.unit_id)?.name ?? "Unknown",
    unit_type: unitMap.get(c.unit_id)?.unit_type ?? "unknown",
    round_number: checkpointMap.get(c.checkpoint_id)?.round_number ?? 0,
    location_name: checkpointMap.get(c.checkpoint_id)?.location_name ?? "Unknown",
    secret_code: c.secret_code,
  }));

  // Sort by unit name, then round number
  mapped.sort((a, b) => {
    if (a.unit_name !== b.unit_name) return a.unit_name.localeCompare(b.unit_name);
    return a.round_number - b.round_number;
  });

  return NextResponse.json({ codes: mapped });
}
