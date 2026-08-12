import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/scan?code=XXXXXXXX
 *
 * Looks up a user by their pass_code barcode.
 * Returns their full profile, team info, and current round progress.
 * Accessible by checkpoint_staff, admin, and super_admin.
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

  // Check role — staff, admin, or super_admin
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["checkpoint_staff", "admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get code from query params
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { error: "Pass code required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1. Find user by pass_code
  const { data: scannedUser, error: userError } = await admin
    .from("users")
    .select(
      "id, name, email, mobile_number, roll_no, branch, semester, role, profile_completed, avatar_url, pass_code, created_at"
    )
    .eq("pass_code", code)
    .single();

  if (userError || !scannedUser) {
    return NextResponse.json(
      { error: "No user found with this pass code", valid: false },
      { status: 404 }
    );
  }

  // 2. Get unit membership
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id, status")
    .eq("user_id", scannedUser.id)
    .in("status", ["accepted", "pending"])
    .single();

  let unit = null;
  let teamMembers: { name: string; email: string; pass_code: string | null }[] = [];
  let roundProgress: { checkpoint_id: string; status: string; completed_at: string | null }[] = [];

  if (membership) {
    // 3. Get unit details
    const { data: unitData } = await admin
      .from("units")
      .select("id, name, unit_type, locked, disqualified, disqualified_reason")
      .eq("id", membership.unit_id)
      .single();

    if (unitData) {
      unit = unitData;

      // 4. Get all team members
      const { data: members } = await admin
        .from("unit_members")
        .select("user_id")
        .eq("unit_id", unitData.id)
        .eq("status", "accepted");

      if (members && members.length > 0) {
        const memberIds = members.map((m) => m.user_id);
        const { data: memberProfiles } = await admin
          .from("users")
          .select("name, email, pass_code")
          .in("id", memberIds);

        teamMembers = memberProfiles ?? [];
      }

      // 5. Get round/checkpoint progress for the unit
      const { data: progress } = await admin
        .from("round_progress")
        .select("checkpoint_id, status, completed_at")
        .eq("unit_id", unitData.id)
        .order("completed_at", { ascending: true });

      roundProgress = progress ?? [];
    }
  }

  return NextResponse.json({
    valid: true,
    user: scannedUser,
    unit,
    teamMembers,
    roundProgress,
    scannedAt: new Date().toISOString(),
  });
}
