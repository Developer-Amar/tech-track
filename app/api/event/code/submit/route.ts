import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { runAgainstTestCases, type SupportedLanguage } from "@/lib/judge0/client";

/**
 * POST /api/event/code/submit
 *
 * Submits code to Judge0, runs against all test cases, saves the submission,
 * and marks the round complete if all pass.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── Verify event is live ──────────────────────────────────────────────
  const { data: settings } = await admin
    .from("event_settings")
    .select("event_live")
    .eq("id", 1)
    .single();

  if (!settings?.event_live) {
    return NextResponse.json({ error: "Event is not live." }, { status: 400 });
  }

  // ── Get user's unit ───────────────────────────────────────────────────
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "You're not registered." }, { status: 400 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { code?: string; language?: string; round?: number; tab_switches?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, language, round } = body;
  if (!code || !language || !round) {
    return NextResponse.json({ error: "code, language, and round are required." }, { status: 400 });
  }

  const validLanguages: SupportedLanguage[] = ["c", "cpp", "python", "java"];
  if (!validLanguages.includes(language as SupportedLanguage)) {
    return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
  }

  // ── Get checkpoint + coding question for this round ───────────────────
  const { data: checkpoint } = await admin
    .from("checkpoints")
    .select("id")
    .eq("round_number", round)
    .single();

  if (!checkpoint) {
    return NextResponse.json({ error: "Invalid round." }, { status: 400 });
  }

  const { data: question } = await admin
    .from("coding_questions")
    .select("id")
    .eq("checkpoint_id", checkpoint.id)
    .single();

  if (!question) {
    return NextResponse.json({ error: "No coding question for this round." }, { status: 400 });
  }

  // ── Get all test cases ────────────────────────────────────────────────
  const { data: testCases } = await admin
    .from("test_cases")
    .select("id, input, expected_output, is_visible")
    .eq("question_id", question.id);

  if (!testCases || testCases.length === 0) {
    return NextResponse.json({ error: "No test cases found." }, { status: 500 });
  }

  // ── Count previous attempts ───────────────────────────────────────────
  const { count: attemptCount } = await admin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", membership.unit_id)
    .eq("checkpoint_id", checkpoint.id);

  const attemptNumber = (attemptCount ?? 0) + 1;

  // ── Run code against test cases via Judge0 ────────────────────────────
  let runResult;
  try {
    runResult = await runAgainstTestCases(
      code,
      language as SupportedLanguage,
      testCases
    );
  } catch (err) {
    console.error("Judge0 execution error:", err);
    return NextResponse.json(
      { error: "Code execution service error. Please try again." },
      { status: 502 }
    );
  }

  // ── Save submission ───────────────────────────────────────────────────
  const tabSwitches = body.tab_switches ?? 0;
  await admin.from("submissions").insert({
    unit_id: membership.unit_id,
    checkpoint_id: checkpoint.id,
    code,
    language,
    passed: runResult.all_passed,
    attempt_number: attemptNumber,
    tab_switches: tabSwitches,
    flagged: tabSwitches > 0,
  });

  // ── If all passed, mark round complete ────────────────────────────────
  if (runResult.all_passed) {
    // Award 50 points total: 10 (riddle) + 10 (checkpoint) + 30 (code)
    await admin
      .from("round_progress")
      .update({
        status: "passed",
        points: 50,
        completed_at: new Date().toISOString(),
      })
      .eq("unit_id", membership.unit_id)
      .eq("checkpoint_id", checkpoint.id);
  }

  // ── Return results (hide hidden test case details) ────────────────────
  const clientResults = runResult.results.map((r) => ({
    passed: r.passed,
    is_visible: r.is_visible,
    input: r.is_visible ? r.input : null,
    expected_output: r.is_visible ? r.expected_output : null,
    actual_output: r.is_visible ? r.actual_output : null,
    error: r.is_visible ? r.error : (r.error ? "Error on hidden test case" : null),
    status: r.status_description,
  }));

  return NextResponse.json({
    all_passed: runResult.all_passed,
    verdict: runResult.verdict,
    compile_error: runResult.compile_error,
    attempt_number: attemptNumber,
    results: clientResults,
  });
}
