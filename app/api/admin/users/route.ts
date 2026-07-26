import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users
 * Returns all users with profile data and their unit membership.
 *
 * PATCH /api/admin/users
 * Updates a user's editable fields (role, name, branch, semester, roll_no).
 * Super admin only.
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

  const { data: users } = await admin
    .from("users")
    .select("id, name, email, mobile_number, roll_no, branch, semester, role, profile_completed, created_at")
    .order("created_at", { ascending: false });

  if (!users) return NextResponse.json({ users: [] });

  // Get unit memberships for all users
  const { data: memberships } = await admin
    .from("unit_members")
    .select("user_id, unit_id, status")
    .in("status", ["accepted", "pending"]);

  // Get unit names
  const unitIds = Array.from(new Set((memberships ?? []).map(m => m.unit_id)));
  const { data: units } = unitIds.length > 0
    ? await admin.from("units").select("id, name, unit_type").in("id", unitIds)
    : { data: [] };

  const unitMap = new Map((units ?? []).map(u => [u.id, u]));

  // Map memberships to users
  const membershipMap = new Map<string, { unit_name: string; unit_type: string; status: string }>();
  for (const m of memberships ?? []) {
    const unit = unitMap.get(m.unit_id);
    if (unit) {
      membershipMap.set(m.user_id, {
        unit_name: unit.name ?? "Solo",
        unit_type: unit.unit_type,
        status: m.status,
      });
    }
  }

  const enriched = users.map(u => ({
    ...u,
    unit: membershipMap.get(u.id) ?? null,
  }));

  return NextResponse.json({ users: enriched });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  let body: { user_id: string; updates: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.user_id || !body.updates) {
    return NextResponse.json({ error: "user_id and updates required" }, { status: 400 });
  }

  // Only allow specific fields to be edited
  const allowed = ["name", "role", "branch", "semester", "roll_no", "mobile_number"];
  const safeUpdates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body.updates)) {
    if (allowed.includes(key)) safeUpdates[key] = val;
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch target user's current profile to prevent demoting super admins
  const { data: targetProfile, error: fetchError } = await admin
    .from("users")
    .select("role")
    .eq("id", body.user_id)
    .single();

  if (fetchError || !targetProfile) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  if (targetProfile.role === "super_admin" && "role" in safeUpdates && safeUpdates.role !== "super_admin") {
    return NextResponse.json({ error: "Access Denied: Super Admin role cannot be removed or altered." }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("users")
    .update(safeUpdates)
    .eq("id", body.user_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action_type: "edit_user",
    action_detail: { target_user: body.user_id, updates: safeUpdates },
  });

  return NextResponse.json({ success: true });
}
