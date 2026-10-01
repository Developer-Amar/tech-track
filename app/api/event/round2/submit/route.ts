import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { runAgainstTestCases, type SupportedLanguage } from "@/lib/judge0/client";
import { analyzeCodeForAI } from "@/lib/proctor/ai-detector";

// In-memory concurrency locks and rate-limiting cooldown per team (TT-10)
const lastRound2SubmissionTime = new Map<string, number>();
const activeRound2Submissions = new Set<string>();
const SUBMISSION_COOLDOWN_MS = 5000; // 5-second minimum gap between submissions
const MAX_CODE_BYTES = 50000; // 50 KB max code payload

/**
 * POST /api/event/round2/submit — Submit code for a Round 2 problem
 * Runs code against hidden test cases via Judge0
 *
 * Security Hardening (TT-10):
 * - Enforces 50KB max code payload size.
 * - Enforces 5s cooldown per unit and in-flight execution lock.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { problem_id?: string; code?: string; language?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.problem_id || !body.code || !body.language) {
    return NextResponse.json({ error: "problem_id, code, and language required" }, { status: 400 });
  }

  // ── TT-10: Code Size Enforcement (50 KB) ──────────────────────────────
  if (typeof body.code !== "string" || body.code.length > MAX_CODE_BYTES) {
    return NextResponse.json(
      { error: `Code exceeds maximum allowed size of ${MAX_CODE_BYTES / 1000} KB.` },
      { status: 400 }
    );
  }

  const validLanguages: SupportedLanguage[] = ["c", "cpp", "python", "java"];
  if (!validLanguages.includes(body.language as SupportedLanguage)) {
    return NextResponse.json({ error: `Unsupported language: ${body.language}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify Round 2 is active
  const { data: settings } = await admin.from("event_settings").select("round_2_active, round_2_stopped").eq("id", 1).single();
  if (!settings?.round_2_active || settings?.round_2_stopped) {
    return NextResponse.json({ error: "Round 2 is not active." }, { status: 400 });
  }

  // Get user's unit
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "You are not part of a team." }, { status: 400 });

  const unitId = membership.unit_id;

  // ── TT-10: Concurrency Lock & Rate Limit Cooldown ─────────────────────
  if (activeRound2Submissions.has(unitId)) {
    return NextResponse.json(
      { error: "A code submission from your team is currently executing. Please wait for it to finish." },
      { status: 429 }
    );
  }

  const now = Date.now();
  const lastTime = lastRound2SubmissionTime.get(unitId) || 0;
  if (now - lastTime < SUBMISSION_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((SUBMISSION_COOLDOWN_MS - (now - lastTime)) / 1000);
    return NextResponse.json(
      { error: `Submission cooldown active. Please wait ${waitSeconds}s before submitting again.` },
      { status: 429 }
    );
  }

  // ── Round 2 Proctor Lockout Guard ──────────────────────────────────────
  const { data: proctorState } = await admin
    .from("proctoring_state")
    .select("locked_out, tab_switches, tab_switch_limit, ai_flags_count")
    .eq("unit_id", membership.unit_id)
    .eq("round_number", 2)
    .maybeSingle();

  if (proctorState?.locked_out) {
    return NextResponse.json(
      { error: "Submission blocked: Your team is locked out by the proctoring system. Contact event staff." },
      { status: 403 }
    );
  }

  // Verify team is qualified for Round 2
  const { data: qualifier } = await admin
    .from("round_qualifiers")
    .select("id")
    .eq("unit_id", membership.unit_id)
    .maybeSingle();
  if (!qualifier) return NextResponse.json({ error: "Your team is not qualified for Round 2." }, { status: 403 });

  // Check if already solved
  const { data: existingProgress } = await admin
    .from("round_2_progress")
    .select("id, status")
    .eq("unit_id", membership.unit_id)
    .eq("problem_id", body.problem_id)
    .maybeSingle();
  if (existingProgress?.status === "passed") {
    return NextResponse.json({ error: "This problem has already been solved." }, { status: 400 });
  }

  // Get problem and all test cases (including hidden)
  const { data: problem } = await admin
    .from("round_2_problems")
    .select("id, points")
    .eq("id", body.problem_id)
    .single();
  if (!problem) return NextResponse.json({ error: "Problem not found." }, { status: 404 });

  const { data: testCases } = await admin
    .from("round_2_test_cases")
    .select("id, input, expected_output, is_visible")
    .eq("problem_id", body.problem_id);

  if (!testCases?.length) {
    return NextResponse.json({ error: "No test cases found for this problem." }, { status: 500 });
  }

  // Count previous attempts
  const { count: prevAttempts } = await admin
    .from("round_2_submissions")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", membership.unit_id)
    .eq("problem_id", body.problem_id);

  // ── Run against all test cases with concurrency lock ─────────────────
  activeRound2Submissions.add(unitId);

  let runResult;
  try {
    runResult = await runAgainstTestCases(
      body.code,
      body.language as SupportedLanguage,
      testCases
    );
  } catch (err) {
    console.error("Judge0 execution error in Round 2:", err);
    return NextResponse.json(
      { error: "Code execution service error. Please try again." },
      { status: 502 }
    );
  } finally {
    activeRound2Submissions.delete(unitId);
    lastRound2SubmissionTime.set(unitId, Date.now());
  }

  // ── AI Code Analysis & Fingerprinting ─────────────────────────────────
  const aiResult = analyzeCodeForAI(body.code, body.language);
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Record submission
  await admin.from("round_2_submissions").insert({
    unit_id: unitId,
    problem_id: body.problem_id,
    code: body.code,
    language: body.language,
    passed: runResult.all_passed,
    attempt_number: (prevAttempts ?? 0) + 1,
    ai_score: aiResult.score,
    ai_flagged: aiResult.flagged,
    ai_reason: aiResult.reasons.join("; "),
  });

  if (aiResult.flagged) {
    await admin.from("proctoring_events").insert({
      unit_id: unitId,
      round_number: 2,
      event_type: "ai_code_flag",
      severity: aiResult.score >= 75 ? "critical" : "high",
      metadata: {
        ai_score: aiResult.score,
        confidence: aiResult.confidence,
        reasons: aiResult.reasons,
        problem_id: body.problem_id,
        client_ip: clientIp,
      },
      occurred_at: new Date().toISOString(),
    });
  }

  // Update progress
  if (runResult.all_passed) {
    await admin.from("round_2_progress").upsert({
      unit_id: unitId,
      problem_id: body.problem_id,
      status: "passed",
      points: problem.points,
      completed_at: new Date().toISOString(),
    }, { onConflict: "unit_id,problem_id" });
  }

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
    success: true,
    passed: runResult.all_passed,
    verdict: runResult.verdict,
    compile_error: runResult.compile_error,
    results: clientResults,
    message: runResult.all_passed ? "All test cases passed!" : (runResult.verdict || "Some test cases failed."),
  });
}
