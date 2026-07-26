import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  // ── Update the user profile ───────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("users")
    .update({
      mobile_number: mobile_number!.trim(),
      roll_no: roll_no!.trim(),
      branch: branch!.trim(),
      semester: semester!,
      profile_completed: true,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Profile update failed:", updateError.message);
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
