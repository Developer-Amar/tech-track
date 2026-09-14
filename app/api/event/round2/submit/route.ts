import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
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
    .select("id, input, expected_output")
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

  // Language ID mapping for Judge0
  const langMap: Record<string, number> = { c: 50, cpp: 54, python: 71, java: 62 };
  const langId = langMap[body.language];
  if (!langId) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  // ── Run against all test cases with concurrency lock ─────────────────
  activeRound2Submissions.add(unitId);

  let allPassed = true;
  const results: { input: string; expected: string; actual: string; passed: boolean }[] = [];

  const judge0Url = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
  const judge0Key = process.env.JUDGE0_API_KEY || "";

  try {
    for (const tc of testCases) {
      try {
        const submitRes = await fetch(`${judge0Url}/submissions?base64_encoded=true&wait=true`, {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": judge0Key,
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          },
          body: JSON.stringify({
            source_code: Buffer.from(body.code).toString("base64"),
            language_id: langId,
            stdin: Buffer.from(tc.input).toString("base64"),
            expected_output: Buffer.from(tc.expected_output).toString("base64"),
          }),
        });

        const result = await submitRes.json();
        const actual = result.stdout ? Buffer.from(result.stdout, "base64").toString() : "";
        const passed = result.status?.id === 3; // Accepted
        results.push({ input: tc.input, expected: tc.expected_output, actual: actual.trim(), passed });
        if (!passed) allPassed = false;
      } catch (err) {
        allPassed = false;
        results.push({ input: tc.input, expected: tc.expected_output, actual: "Execution error", passed: false });
      }
    }
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
    passed: allPassed,
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
  if (allPassed) {
    await admin.from("round_2_progress").upsert({
      unit_id: unitId,
      problem_id: body.problem_id,
      status: "passed",
      points: problem.points,
      completed_at: new Date().toISOString(),
    }, { onConflict: "unit_id,problem_id" });
  }

  return NextResponse.json({
    success: true,
    passed: allPassed,
    results: results.map(r => ({
      passed: r.passed,
      // Only show details for visible test cases
    })),
    message: allPassed ? "All test cases passed!" : "Some test cases failed.",
  });
}
