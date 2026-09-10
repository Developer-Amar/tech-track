import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/scan?code=XXXXXXXX
 *
 * Looks up a user by their pass_code barcode/QR.
 * Resolves their unit (as leader or member), current active round,
 * outpost secret code, and status.
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

  // Check role — checkpoint_staff, admin, or super_admin
  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
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
  const rawCode = searchParams.get("code")?.trim() || "";

  if (!rawCode) {
    return NextResponse.json(
      { error: "Pass code required", valid: false },
      { status: 400 }
    );
  }

  // Sanitize code: handle full URL or trailing tokens if raw string is scanned
  let code = rawCode.toUpperCase();
  const urlMatch = rawCode.match(/([A-Z0-9]{8})$/i);
  if (urlMatch) {
    code = urlMatch[1].toUpperCase();
  }

  const admin = createAdminClient();

  // 1. Find user by pass_code
  const { data: scannedUser, error: userError } = await admin
    .from("users")
    .select(
      "id, name, email, mobile_number, roll_no, branch, semester, role, profile_completed, avatar_url, pass_code, created_at"
    )
    .ilike("pass_code", code)
    .maybeSingle();

  if (userError || !scannedUser) {
    return NextResponse.json(
      { error: `No attendee found with pass code "${code}"`, valid: false },
      { status: 404 }
    );
  }

  // 2. Get unit membership (accepted or pending)
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id, status")
    .eq("user_id", scannedUser.id)
    .in("status", ["accepted", "pending"])
    .maybeSingle();

  let unit = null;
  let teamMembers: {
    name: string;
    email: string;
    pass_code: string | null;
    roll_no?: string;
    branch?: string;
    semester?: number;
  }[] = [];
  let rounds: {
    round_number: number;
    checkpoint_id: string;
    location_name: string;
    secret_code: string | null;
    status: string;
    points: number;
    completed_at: string | null;
    is_active: boolean;
  }[] = [];
  let activeRound: {
    round_number: number;
    checkpoint_id: string;
    location_name: string;
    secret_code: string | null;
    status: string;
    canVerify: boolean;
    isVerified: boolean;
  } | null = null;
  let allRoundsCompleted = false;

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
          .select("name, email, pass_code, roll_no, branch, semester")
          .in("id", memberIds);

        teamMembers = memberProfiles ?? [];
      }

      // 5. Get all checkpoints
      const { data: checkpoints } = await admin
        .from("checkpoints")
        .select("id, round_number, location_name")
        .order("round_number", { ascending: true });

      // 6. Get round progress for unit
      const { data: progressList } = await admin
        .from("round_progress")
        .select("checkpoint_id, status, points, completed_at")
        .eq("unit_id", unitData.id);

      const progressMap = new Map(
        (progressList ?? []).map((p) => [p.checkpoint_id, p])
      );

      // 7. Get secret codes for unit from unit_checkpoint_codes
      const { data: codesList } = await admin
        .from("unit_checkpoint_codes")
        .select("checkpoint_id, secret_code")
        .eq("unit_id", unitData.id);

      const codesMap = new Map(
        (codesList ?? []).map((c) => [c.checkpoint_id, c.secret_code])
      );

      // 8. Map all rounds and determine active round
      let foundActive = false;

      for (const cp of checkpoints ?? []) {
        const p = progressMap.get(cp.id);
        const secretCode = codesMap.get(cp.id) ?? null;
        const status = p?.status ?? "not_started";
        const points = p?.points ?? 0;
        const completed_at = p?.completed_at ?? null;

        const isFinished = status === "passed" || status === "skipped";
        let is_active = false;

        if (!isFinished && !foundActive) {
          is_active = true;
          foundActive = true;

          activeRound = {
            round_number: cp.round_number,
            checkpoint_id: cp.id,
            location_name: cp.location_name,
            secret_code: secretCode,
            status,
            canVerify: status !== "checkpoint_done",
            isVerified: status === "checkpoint_done",
          };
        }

        rounds.push({
          round_number: cp.round_number,
          checkpoint_id: cp.id,
          location_name: cp.location_name,
          secret_code: secretCode,
          status,
          points,
          completed_at,
          is_active,
        });
      }

      if (!foundActive && (checkpoints ?? []).length > 0) {
        allRoundsCompleted = true;
      }
    }
  }

  return NextResponse.json({
    valid: true,
    user: scannedUser,
    unit,
    teamMembers,
    rounds,
    activeRound,
    allRoundsCompleted,
    scannedAt: new Date().toISOString(),
  });
}

/**
 * POST /api/scan
 *
 * Verifies and marks a checkpoint as completed for a team.
 * Auto-advances the team to the coding challenge.
 * Accessible by checkpoint_staff, admin, and super_admin.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check role — checkpoint_staff, admin, or super_admin
  const { data: staffProfile } = await supabase
    .from("users")
    .select("id, name, role")
    .eq("id", user.id)
    .single();

  if (
    !staffProfile ||
    !["checkpoint_staff", "admin", "super_admin"].includes(staffProfile.role)
  ) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let body: {
    unit_id?: string;
    checkpoint_id?: string;
    pass_code?: string;
    round?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  let targetUnitId = body.unit_id;
  let targetCheckpointId = body.checkpoint_id;

  // If pass_code is provided, resolve the unit and active checkpoint
  if (body.pass_code && (!targetUnitId || !targetCheckpointId)) {
    const code = body.pass_code.trim().toUpperCase();
    const { data: scannedUser } = await admin
      .from("users")
      .select("id")
      .ilike("pass_code", code)
      .maybeSingle();

    if (!scannedUser) {
      return NextResponse.json(
        { error: "No attendee found with this pass code." },
        { status: 404 }
      );
    }

    const { data: membership } = await admin
      .from("unit_members")
      .select("unit_id")
      .eq("user_id", scannedUser.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "User is not part of an active team." },
        { status: 400 }
      );
    }

    targetUnitId = membership.unit_id;

    // Resolve checkpoint if missing
    if (!targetCheckpointId) {
      const { data: checkpoints } = await admin
        .from("checkpoints")
        .select("id, round_number")
        .order("round_number", { ascending: true });

      const { data: progressList } = await admin
        .from("round_progress")
        .select("checkpoint_id, status")
        .eq("unit_id", targetUnitId);

      const progressMap = new Map((progressList ?? []).map((p) => [p.checkpoint_id, p]));

      for (const cp of checkpoints ?? []) {
        const p = progressMap.get(cp.id);
        const status = p?.status ?? "not_started";
        if (status !== "passed" && status !== "skipped") {
          targetCheckpointId = cp.id;
          break;
        }
      }
    }
  }

  // If round number was provided instead of checkpoint_id
  if (body.round && !targetCheckpointId) {
    const { data: cp } = await admin
      .from("checkpoints")
      .select("id")
      .eq("round_number", body.round)
      .maybeSingle();
    if (cp) {
      targetCheckpointId = cp.id;
    }
  }

  if (!targetUnitId || !targetCheckpointId) {
    return NextResponse.json(
      { error: "Unable to determine unit or checkpoint to verify." },
      { status: 400 }
    );
  }

  // Fetch checkpoint details for confirmation message and audit logging
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("round_number, location_name")
    .eq("id", targetCheckpointId)
    .single();

  const { data: targetUnit } = await admin
    .from("units")
    .select("name")
    .eq("id", targetUnitId)
    .single();

  // ── Update or insert round_progress ──────────────────────────────────
  const { data: existingProgress } = await admin
    .from("round_progress")
    .select("id, status, points")
    .eq("unit_id", targetUnitId)
    .eq("checkpoint_id", targetCheckpointId)
    .maybeSingle();

  if (existingProgress) {
    if (
      existingProgress.status === "passed" ||
      existingProgress.status === "skipped"
    ) {
      return NextResponse.json({
        success: false,
        already_completed: true,
        message: `Round ${checkpoint?.round_number ?? ""} is already completed by ${targetUnit?.name ?? "this team"}.`,
      });
    }

    await admin
      .from("round_progress")
      .update({
        status: "checkpoint_done",
        points: Math.max(existingProgress.points || 0, 20),
      })
      .eq("id", existingProgress.id);
  } else {
    // If team arrived at outpost before riddle submit or via bypass, insert directly
    await admin.from("round_progress").insert({
      unit_id: targetUnitId,
      checkpoint_id: targetCheckpointId,
      status: "checkpoint_done",
      points: 20,
    });
  }

  // ── Log in audit_log ──────────────────────────────────────────────────
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action_type: "checkpoint_verified",
    action_detail: {
      staff_name: staffProfile.name,
      staff_role: staffProfile.role,
      unit_id: targetUnitId,
      unit_name: targetUnit?.name,
      checkpoint_id: targetCheckpointId,
      round_number: checkpoint?.round_number,
      location_name: checkpoint?.location_name,
      method: "qr_scanner_auto_advance",
    },
  });

  return NextResponse.json({
    success: true,
    message: `Team "${targetUnit?.name ?? "Team"}" verified at ${checkpoint?.location_name ?? "Checkpoint"} (Round ${checkpoint?.round_number ?? ""})! Advanced to Coding Challenge.`,
    unit_id: targetUnitId,
    checkpoint_id: targetCheckpointId,
    round_number: checkpoint?.round_number,
    location_name: checkpoint?.location_name,
  });
}
