import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Generate an 8-character unique pass code (no ambiguous chars: 0/O, 1/I/L) */
function generatePassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * POST /api/profile/complete
 *
 * Saves mobile number, roll no., branch, and semester for the current user
 * and marks their profile as complete. This gates access to the dashboard.
 */
export async function POST(request: Request) {
  const supabase = createClient();

  // ── Auth check ────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // ── Parse and validate body ───────────────────────────────────────────
  let body: {
    mobile_number?: string;
    roll_no?: string;
    branch?: string;
    semester?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { mobile_number, roll_no, branch, semester } = body;

  const errors: string[] = [];
  if (!mobile_number?.trim()) errors.push("Mobile number is required");
  if (!roll_no?.trim()) errors.push("Roll number is required");
  if (!branch?.trim()) errors.push("Branch is required");
  if (!semester || semester < 1 || semester > 10) {
    errors.push("Semester must be between 1 and 10");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  // ── Query existing user to preserve role and pass_code ────────────────
  const adminClient = createAdminClient();
  const { data: existingUser } = await adminClient
    .from("users")
    .select("role, pass_code")
    .eq("id", user.id)
    .maybeSingle();

  // Generate pass code only if the user doesn't already have one
  const passCode = existingUser?.pass_code || generatePassCode();

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Participant";

  // Preserve existing elevated role (e.g. checkpoint_staff, admin) or super_admin
  let userRole = existingUser?.role || "participant";
  if (user.email === "amar4594.ece25@chitkara.edu.in") {
    userRole = "super_admin";
  }

  const { error: upsertError } = await adminClient
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email!,
        name: userName,
        mobile_number: mobile_number!.trim(),
        roll_no: roll_no!.trim(),
        branch: branch!.trim(),
        semester: semester!,
        profile_completed: true,
        pass_code: passCode,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role: userRole,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    console.error("Profile upsert failed:", upsertError.message);
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
