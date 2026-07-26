import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/content
 *
 * CRUD operations for event content: checkpoints, riddles, questions, test_cases.
 * Also handles add_round and remove_last_round.
 * Super admin only.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  let body: { entity?: string; action: string; data?: Record<string, any> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { entity, action, data } = body;

  const admin = createAdminClient();

  // ── Fetch Event Settings to enforce the locking constraints ──────────
  const { data: settings, error: settingsError } = await admin
    .from("event_settings")
    .select("registration_open, event_live, total_rounds")
    .eq("id", 1)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json({ error: "Failed to fetch event settings" }, { status: 500 });
  }

  const isLocked = !settings.registration_open || settings.event_live;
  if (isLocked) {
    return NextResponse.json(
      { error: "Access Denied: Rounds are locked because registration is closed or the event is live." },
      { status: 403 }
    );
  }

  // ── Action: Add Round ────────────────────────────────────────────────
  if (action === "add_round") {
    const nextRound = settings.total_rounds + 1;

    // 1. Create Checkpoint
    const { data: cp, error: cpError } = await admin
      .from("checkpoints")
      .insert({
        location_name: `Checkpoint Round ${nextRound}`,
        round_number: nextRound,
      })
      .select()
      .single();

    if (cpError || !cp) {
      return NextResponse.json({ error: cpError?.message || "Failed to create checkpoint" }, { status: 500 });
    }

    // 2. Create Riddle
    const { error: riddleError } = await admin
      .from("riddles")
      .insert({
        checkpoint_id: cp.id,
        content: `Solve this riddle to find the location for Round ${nextRound}.`,
      });

    if (riddleError) {
      return NextResponse.json({ error: riddleError.message }, { status: 500 });
    }

    // 3. Create Coding Question
    const { data: question, error: qError } = await admin
      .from("coding_questions")
      .insert({
        checkpoint_id: cp.id,
        prompt: "Write a program that takes an integer N from stdin and prints N to stdout.",
        sample_input: "5",
        sample_output: "5",
      })
      .select()
      .single();

    if (qError || !question) {
      return NextResponse.json({ error: qError?.message || "Failed to create coding challenge" }, { status: 500 });
    }

    // 4. Create Mock Test Cases
    const { error: tcError } = await admin
      .from("test_cases")
      .insert([
        { question_id: question.id, input: "5", expected_output: "5", is_visible: true },
        { question_id: question.id, input: "12", expected_output: "12", is_visible: false },
      ]);

    if (tcError) {
      return NextResponse.json({ error: tcError.message }, { status: 500 });
    }

    // 5. Update event settings total_rounds
    await admin
      .from("event_settings")
      .update({ total_rounds: nextRound })
      .eq("id", 1);

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "add_round",
      action_detail: { new_round: nextRound },
    });

    return NextResponse.json({ success: true, message: `Round ${nextRound} successfully added.` });
  }

  // ── Action: Remove Last Round ────────────────────────────────────────
  if (action === "remove_last_round") {
    const currentRound = settings.total_rounds;
    if (currentRound <= 1) {
      return NextResponse.json({ error: "Cannot remove the final remaining round." }, { status: 400 });
    }

    // Find the checkpoint to delete
    const { data: cp, error: cpFetchError } = await admin
      .from("checkpoints")
      .select("id")
      .eq("round_number", currentRound)
      .single();

    if (cpFetchError || !cp) {
      return NextResponse.json({ error: "Last round checkpoint not found" }, { status: 404 });
    }

    // Delete test cases and coding questions
    const { data: question } = await admin
      .from("coding_questions")
      .select("id")
      .eq("checkpoint_id", cp.id)
      .maybeSingle();

    if (question) {
      await admin.from("test_cases").delete().eq("question_id", question.id);
      await admin.from("coding_questions").delete().eq("id", question.id);
    }

    // Delete riddle and checkpoint
    await admin.from("riddles").delete().eq("checkpoint_id", cp.id);
    await admin.from("checkpoints").delete().eq("id", cp.id);

    // Update settings total_rounds
    const nextRound = currentRound - 1;
    await admin
      .from("event_settings")
      .update({ total_rounds: nextRound })
      .eq("id", 1);

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "remove_round",
      action_detail: { removed_round: currentRound },
    });

    return NextResponse.json({ success: true, message: `Round ${currentRound} successfully removed.` });
  }

  // ── Standard Entity Validation for updates ────────────────────────────
  const validEntities = ["checkpoints", "riddles", "coding_questions", "test_cases"];
  if (!entity || !validEntities.includes(entity)) {
    return NextResponse.json({ error: `Invalid entity: ${entity}` }, { status: 400 });
  }

  switch (action) {
    case "create": {
      const { data: created, error } = await admin.from(entity).insert(data).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: `create_${entity}`,
        action_detail: { entity, data },
      });

      return NextResponse.json({ success: true, record: created });
    }

    case "update": {
      if (!data || !data.id) return NextResponse.json({ error: "id required for update" }, { status: 400 });
      const id = data.id as string;

      const updates = { ...data };
      delete updates.id;

      const { error } = await admin.from(entity).update(updates).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: `update_${entity}`,
        action_detail: { entity, id, updates },
      });

      return NextResponse.json({ success: true });
    }

    case "delete": {
      if (!data || !data.id) return NextResponse.json({ error: "id required for delete" }, { status: 400 });
      const deleteId = data.id as string;

      const { error } = await admin.from(entity).delete().eq("id", deleteId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action_type: `delete_${entity}`,
        action_detail: { entity, id: deleteId },
      });

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }
}

/**
 * GET /api/admin/content
 * Returns all content: checkpoints + riddles + questions + test_cases + locking status
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

  const { data: settings } = await admin
    .from("event_settings")
    .select("registration_open, event_live")
    .eq("id", 1)
    .single();

  const isLocked = settings ? (!settings.registration_open || settings.event_live) : false;

  const { data: checkpoints } = await admin.from("checkpoints").select("*").order("round_number");
  const { data: riddles } = await admin.from("riddles").select("*");
  const { data: questions } = await admin.from("coding_questions").select("*");
  const { data: testCases } = await admin.from("test_cases").select("*");

  return NextResponse.json({
    checkpoints,
    riddles,
    questions,
    test_cases: testCases,
    is_locked: isLocked,
  });
}
