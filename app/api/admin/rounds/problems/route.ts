import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ProblemAction =
  | { action: "create"; problem: any }
  | { action: "update"; problem: any }
  | { action: "delete"; problem_id: string };

/**
 * GET /api/admin/rounds/problems — List all Round 2 problems with test cases
 * POST /api/admin/rounds/problems — CRUD for Round 2 problems
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: problems } = await admin
    .from("round_2_problems")
    .select("*, test_cases:round_2_test_cases (*)")
    .order("order_index");

  return NextResponse.json({ problems: problems ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: ProblemAction;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (body.action) {
    case "create": {
      const { test_cases, id, ...problemData } = body.problem;
      const { data: created, error } = await admin
        .from("round_2_problems")
        .insert(problemData)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Insert test cases
      if (test_cases?.length > 0) {
        const tcRows = test_cases.map((tc: any) => ({
          problem_id: created.id,
          input: tc.input,
          expected_output: tc.expected_output,
          is_visible: tc.is_visible ?? false,
        }));
        await admin.from("round_2_test_cases").insert(tcRows);
      }

      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "create_r2_problem",
        action_detail: { problem_id: created.id, title: problemData.title },
      });
      return NextResponse.json({ success: true, problem: created, message: "Problem created." });
    }

    case "update": {
      const { test_cases, id, ...updateData } = body.problem;
      if (!id) return NextResponse.json({ error: "Problem ID required for update" }, { status: 400 });

      await admin.from("round_2_problems").update(updateData).eq("id", id);

      // Replace test cases: delete existing, insert new
      if (test_cases) {
        await admin.from("round_2_test_cases").delete().eq("problem_id", id);
        if (test_cases.length > 0) {
          const tcRows = test_cases.map((tc: any) => ({
            problem_id: id,
            input: tc.input,
            expected_output: tc.expected_output,
            is_visible: tc.is_visible ?? false,
          }));
          await admin.from("round_2_test_cases").insert(tcRows);
        }
      }

      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "update_r2_problem",
        action_detail: { problem_id: id, title: updateData.title },
      });
      return NextResponse.json({ success: true, message: "Problem updated." });
    }

    case "delete": {
      if (!body.problem_id) return NextResponse.json({ error: "problem_id required" }, { status: 400 });
      // Test cases cascade delete via FK
      await admin.from("round_2_problems").delete().eq("id", body.problem_id);
      await admin.from("audit_log").insert({
        actor_id: user.id, action_type: "delete_r2_problem",
        action_detail: { problem_id: body.problem_id },
      });
      return NextResponse.json({ success: true, message: "Problem deleted." });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
