import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET  /api/admin/users/manage  → List all blocked emails
 * POST /api/admin/users/manage  → Destructive user management
 *
 * Actions:
 *  - "delete"  → Permanently remove a user (they can re-register)
 *  - "block"   → Permanently remove + ban a user (cannot re-register)
 *  - "unblock" → Remove an email from the blocked list
 *  - "purge"   → Delete ALL users except the primary super admin
 *
 * Body: { action, user_id?, email?, reason?, confirmation? }
 */

const PROTECTED_SUPERADMIN_EMAIL = "amar4594.ece25@chitkara.edu.in";

// ── GET: List all blocked emails ──
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: blocked } = await admin
    .from("blocked_emails")
    .select("id, email, reason, blocked_at")
    .order("blocked_at", { ascending: false });

  return NextResponse.json({ blocked: blocked ?? [] });
}

export async function POST(request: Request) {
  // ── Auth + role check ──
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  let body: {
    action: string;
    user_id?: string;
    email?: string;
    reason?: string;
    confirmation?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ════════════════════════════════════════════════════════════════
  // ACTION: DELETE — Remove a single user permanently
  // ════════════════════════════════════════════════════════════════
  if (body.action === "delete") {
    if (!body.user_id)
      return NextResponse.json(
        { error: "user_id required" },
        { status: 400 }
      );

    try {
      await cleanupAndDeleteUser(admin, body.user_id);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to delete user" },
        { status: 400 }
      );
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "delete_user",
      action_detail: {
        target_user: body.user_id,
        reason: body.reason || "Removed by admin",
      },
    });

    return NextResponse.json({ success: true, message: "User deleted" });
  }

  // ════════════════════════════════════════════════════════════════
  // ACTION: BLOCK — Remove user + ban their email permanently
  // ════════════════════════════════════════════════════════════════
  if (body.action === "block") {
    if (!body.user_id)
      return NextResponse.json(
        { error: "user_id required" },
        { status: 400 }
      );

    // Get user email before deletion
    const { data: targetUser } = await admin
      .from("users")
      .select("email, role")
      .eq("id", body.user_id)
      .single();

    if (!targetUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (targetUser.email === PROTECTED_SUPERADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Cannot block the primary super admin" },
        { status: 403 }
      );
    }

    // Add to blocked list
    const { error: blockError } = await admin
      .from("blocked_emails")
      .insert({
        email: targetUser.email,
        blocked_by: user.id,
        reason: body.reason || "Blocked by admin",
      });

    if (blockError && !blockError.message.includes("duplicate")) {
      return NextResponse.json(
        { error: blockError.message },
        { status: 500 }
      );
    }

    // Then delete the user
    try {
      await cleanupAndDeleteUser(admin, body.user_id);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to delete user after blocking" },
        { status: 400 }
      );
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "block_user",
      action_detail: {
        target_email: targetUser.email,
        reason: body.reason || "Blocked by admin",
      },
    });

    return NextResponse.json({
      success: true,
      message: `${targetUser.email} blocked and removed`,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ACTION: PURGE — Delete ALL users except primary super admin
  // ════════════════════════════════════════════════════════════════
  if (body.action === "purge") {
    if (body.confirmation !== "PURGE") {
      return NextResponse.json(
        { error: 'Type "PURGE" to confirm this destructive action' },
        { status: 400 }
      );
    }

    // Get ALL users except the protected super admin
    const { data: allUsers } = await admin
      .from("users")
      .select("id, email")
      .neq("email", PROTECTED_SUPERADMIN_EMAIL);

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users to purge",
        deleted: 0,
      });
    }

    let deleted = 0;
    const errors: string[] = [];

    for (const u of allUsers) {
      try {
        await cleanupAndDeleteUser(admin, u.id);
        deleted++;
      } catch (err: any) {
        errors.push(`${u.email}: ${err.message}`);
      }
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "purge_all_users",
      action_detail: {
        deleted_count: deleted,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Purged ${deleted} users`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ACTION: UNBLOCK — Remove an email from the blocked list
  // ════════════════════════════════════════════════════════════════
  if (body.action === "unblock") {
    if (!body.email)
      return NextResponse.json(
        { error: "email required" },
        { status: 400 }
      );

    const { error: unblockError } = await admin
      .from("blocked_emails")
      .delete()
      .eq("email", body.email);

    if (unblockError) {
      return NextResponse.json(
        { error: unblockError.message },
        { status: 500 }
      );
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "unblock_user",
      action_detail: { email: body.email },
    });

    return NextResponse.json({
      success: true,
      message: `${body.email} unblocked`,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER: Clean up all foreign-key dependencies, then delete the auth user
// ════════════════════════════════════════════════════════════════════════════

async function cleanupAndDeleteUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  // 0. Safety check: never delete the protected super admin
  const { data: targetUser } = await admin
    .from("users")
    .select("email, role")
    .eq("id", userId)
    .single();

  if (!targetUser) throw new Error("User not found");
  if (targetUser.email === PROTECTED_SUPERADMIN_EMAIL) {
    throw new Error("Cannot delete the primary super admin");
  }

  // 1. Find units where this user is the LEADER
  const { data: leaderUnits } = await admin
    .from("units")
    .select("id")
    .eq("leader_id", userId);

  const unitIds = (leaderUnits ?? []).map((u) => u.id);

  if (unitIds.length > 0) {
    // 2. Delete all data from tables that reference these units
    //    (submissions, round_progress, proctoring_events, notifications
    //     don't have ON DELETE CASCADE on unit_id)
    await admin.from("proctoring_events").delete().in("unit_id", unitIds);
    await admin.from("notifications").delete().in("unit_id", unitIds);
    await admin.from("submissions").delete().in("unit_id", unitIds);
    await admin.from("round_progress").delete().in("unit_id", unitIds);
    // unit_members + unit_checkpoint_codes cascade from units(id)
    await admin.from("units").delete().in("id", unitIds);
  }

  // 3. Remove from any remaining unit memberships (non-leader)
  await admin.from("unit_members").delete().eq("user_id", userId);

  // 4. Clear audit_log references (preserve records, null out actor)
  await admin
    .from("audit_log")
    .update({ actor_id: null } as any)
    .eq("actor_id", userId);

  // 5. Delete auth user → cascades to public.users + checkpoint_staff_assignments
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Auth deletion failed: ${error.message}`);
}
