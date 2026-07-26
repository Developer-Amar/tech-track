// Phase 0 verification script — tests Judge0 CE connectivity via RapidAPI
//
// Usage:
//   npx tsx scripts/test-judge0.ts
//
// Reads JUDGE0_API_URL and JUDGE0_API_KEY from .env.local in the project root.
// Submits a trivial "hello world" in Python to Judge0 and confirms it comes
// back Accepted with the correct output.

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// 1. Load environment variables from .env.local
// ---------------------------------------------------------------------------

function loadEnvFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local doesn't exist — rely on pre-existing process.env values
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// ---------------------------------------------------------------------------
// 2. Validate required env vars
// ---------------------------------------------------------------------------

const JUDGE0_API_URL = process.env.JUDGE0_API_URL?.replace(/\/+$/, "");
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

const missing: string[] = [];
if (!JUDGE0_API_URL) missing.push("JUDGE0_API_URL");
if (!JUDGE0_API_KEY) missing.push("JUDGE0_API_KEY");

if (missing.length > 0) {
  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════╗");
  console.error("║  Missing required environment variables                     ║");
  console.error("╚══════════════════════════════════════════════════════════════╝");
  console.error("");
  for (const name of missing) {
    console.error(`  ✗  ${name} is not set or is empty.`);
  }
  console.error("");
  console.error("  These variables must be defined in a .env.local file at the");
  console.error("  project root.  Example:");
  console.error("");
  console.error("    JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com");
  console.error("    JUDGE0_API_KEY=your-rapidapi-key-here");
  console.error("");
  console.error("  Sign up at https://rapidapi.com and subscribe to Judge0 CE");
  console.error("  (free Basic plan — no credit card required).");
  console.error("");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Submit a trivial "hello world" to Judge0
// ---------------------------------------------------------------------------

interface Judge0Status {
  id: number;
  description: string;
}

interface Judge0Result {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: Judge0Status;
  time: string | null;
  memory: number | null;
}

async function runTest(): Promise<void> {
  const SUBMIT_URL = `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`;
  const API_HOST = "judge0-ce.p.rapidapi.com";

  // Python "hello world" — language_id 71
  const sourceCode = 'print("hello world")';
  const sourceB64 = Buffer.from(sourceCode).toString("base64");

  console.log("");
  console.log("┌──────────────────────────────────────────────────────────────┐");
  console.log("│  Tech Track — Judge0 Verification                           │");
  console.log("└──────────────────────────────────────────────────────────────┘");
  console.log("");
  console.log(`  Target:   ${JUDGE0_API_URL}`);
  console.log(`  Submitting: print("hello world")  [Python, language_id=71]`);
  console.log("");

  interface CheckResult {
    label: string;
    passed: boolean;
    detail: string;
  }

  const results: CheckResult[] = [];

  // --- Check 1: Submit and get a response ---

  let result: Judge0Result | null = null;

  try {
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": JUDGE0_API_KEY!,
        "X-RapidAPI-Host": API_HOST,
      },
      body: JSON.stringify({
        source_code: sourceB64,
        language_id: 71,
        stdin: "",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 401 || res.status === 403) {
      results.push({
        label: "API authentication",
        passed: false,
        detail: `Judge0 returned ${res.status} — your JUDGE0_API_KEY is invalid or expired. Check your RapidAPI dashboard.`,
      });
    } else if (res.status === 429) {
      results.push({
        label: "API authentication",
        passed: false,
        detail: "Judge0 returned 429 (rate limited) — you've hit the free tier's request quota. Wait a moment and try again.",
      });
    } else if (!res.ok) {
      const body = await res.text().catch(() => "");
      results.push({
        label: "API authentication",
        passed: false,
        detail: `Judge0 returned ${res.status}: ${body.slice(0, 200)}`,
      });
    } else {
      result = (await res.json()) as Judge0Result;
      results.push({
        label: "API authentication",
        passed: true,
        detail: "RapidAPI key accepted, submission created successfully.",
      });
    }
  } catch (err) {
    results.push({
      label: "API authentication",
      passed: false,
      detail: `Could not reach Judge0 — ${(err as Error).message}`,
    });
  }

  // --- Check 2: Status is Accepted (id === 3) ---

  if (result) {
    if (result.status.id === 3) {
      results.push({
        label: "Execution status",
        passed: true,
        detail: `Status: ${result.status.description} (id=${result.status.id}), time=${result.time}s, memory=${result.memory}KB`,
      });
    } else {
      results.push({
        label: "Execution status",
        passed: false,
        detail: `Expected Accepted (3), got: ${result.status.description} (id=${result.status.id}). stderr: ${result.stderr ?? "none"}, compile_output: ${result.compile_output ?? "none"}`,
      });
    }
  } else {
    results.push({
      label: "Execution status",
      passed: false,
      detail: "Cannot check — submission failed (see above).",
    });
  }

  // --- Check 3: stdout matches expected output ---

  if (result) {
    // Decode base64 stdout
    const stdout = result.stdout
      ? Buffer.from(result.stdout, "base64").toString("utf-8").trim()
      : "";

    if (stdout === "hello world") {
      results.push({
        label: "Output correctness",
        passed: true,
        detail: `stdout: "${stdout}" — matches expected output.`,
      });
    } else {
      results.push({
        label: "Output correctness",
        passed: false,
        detail: `Expected "hello world", got: "${stdout}"`,
      });
    }
  } else {
    results.push({
      label: "Output correctness",
      passed: false,
      detail: "Cannot check — submission failed (see above).",
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Print summary
  // ---------------------------------------------------------------------------

  let allPassed = true;

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const color = r.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`  ${color}${icon}${reset}  ${r.label}`);
    console.log(`     ${r.detail}`);
    console.log("");
    if (!r.passed) allPassed = false;
  }

  if (allPassed) {
    console.log("  All checks passed — Judge0 is ready. 🚀");
  } else {
    console.log("  Some checks failed — see details above.");
  }
  console.log("");

  process.exit(allPassed ? 0 : 1);
}

runTest();
