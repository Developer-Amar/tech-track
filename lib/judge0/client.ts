/**
 * Judge0 code execution client — wraps HTTP calls to Judge0 CE via RapidAPI.
 *
 * IMPORTANT: This module runs SERVER-SIDE ONLY. It uses JUDGE0_API_URL and
 * JUDGE0_API_KEY, which must never reach client-side code.
 *
 * Built in Phase 4 (Event Engine).
 */

const JUDGE0_API_URL = process.env.JUDGE0_API_URL!;
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY!;
const JUDGE0_API_HOST = "judge0-ce.p.rapidapi.com";

/**
 * Judge0 language IDs for our four supported languages.
 * Stable in Judge0 CE for years — cross-check against GET /languages
 * on first integration per TRD §5.
 */
export const LANGUAGE_IDS: Record<string, number> = {
  c: 50,       // C (GCC 9.2.0)
  cpp: 54,     // C++ (GCC 9.2.0)
  python: 71,  // Python (3.8.1)
  java: 62,    // Java (OpenJDK 13.0.1)
} as const;

export type SupportedLanguage = "c" | "cpp" | "python" | "java";

export interface Judge0SubmitRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
}

/**
 * Judge0 submission response shape (relevant fields only).
 * Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer,
 * 5=TLE, 6=Compilation Error, 7–12=various runtime errors, 13=Internal Error.
 */
export interface Judge0SubmissionResult {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

export interface TestCaseResult {
  test_case_id: string;
  input: string;
  expected_output: string;
  actual_output: string | null;
  passed: boolean;
  is_visible: boolean;
  error: string | null;
  status_description: string;
}

export interface RunResult {
  all_passed: boolean;
  verdict: string;
  results: TestCaseResult[];
  compile_error: string | null;
}

/**
 * Submit code to Judge0 via RapidAPI and wait for the result synchronously.
 *
 * - Source code and stdin are base64-encoded (Judge0 best practice).
 * - Uses ?wait=true for a synchronous response — appropriate for our
 *   low-volume event rather than polling with tokens.
 */
export async function executeCode(
  request: Judge0SubmitRequest
): Promise<Judge0SubmissionResult> {
  const languageId = LANGUAGE_IDS[request.language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${request.language}`);
  }

  // Base64-encode source code and stdin per Judge0 convention
  const sourceB64 = Buffer.from(request.code).toString("base64");
  const stdinB64 = Buffer.from(request.stdin ?? "").toString("base64");

  const response = await fetch(
    `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": JUDGE0_API_HOST,
      },
      body: JSON.stringify({
        source_code: sourceB64,
        language_id: languageId,
        stdin: stdinB64,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Judge0 submission failed: ${response.status} ${response.statusText} — ${body.slice(0, 300)}`
    );
  }

  const result = (await response.json()) as Judge0SubmissionResult;

  // Decode base64 fields in the response
  if (result.stdout) {
    result.stdout = Buffer.from(result.stdout, "base64").toString("utf-8");
  }
  if (result.stderr) {
    result.stderr = Buffer.from(result.stderr, "base64").toString("utf-8");
  }
  if (result.compile_output) {
    result.compile_output = Buffer.from(result.compile_output, "base64").toString("utf-8");
  }

  return result;
}

/**
 * Run code against an array of test cases and return per-case results.
 *
 * - Runs test cases sequentially (RapidAPI rate limits).
 * - Short-circuits on compilation error (same error for all languages).
 * - Trims whitespace from stdout before comparison.
 */
export async function runAgainstTestCases(
  code: string,
  language: SupportedLanguage,
  testCases: { id: string; input: string; expected_output: string; is_visible: boolean }[]
): Promise<RunResult> {
  const results: TestCaseResult[] = [];
  let compileError: string | null = null;

  for (const tc of testCases) {
    try {
      const result = await executeCode({ language, code, stdin: tc.input });

      // Status 6 = Compilation Error — short-circuit, same for all cases
      if (result.status.id === 6) {
        compileError = result.compile_output || result.stderr || "Compilation failed";
        // Mark all remaining test cases as failed with the compile error
        for (const remaining of testCases) {
          results.push({
            test_case_id: remaining.id,
            input: remaining.input,
            expected_output: remaining.expected_output,
            actual_output: null,
            passed: false,
            is_visible: remaining.is_visible,
            error: compileError,
            status_description: "Compilation Error",
          });
        }
        return { all_passed: false, verdict: "Compilation Error", results, compile_error: compileError };
      }

      const actualOutput = (result.stdout ?? "").trim();
      const expectedOutput = tc.expected_output.trim();
      const passed = result.status.id === 3 && actualOutput === expectedOutput;

      let error: string | null = null;
      if (result.status.id !== 3 && result.status.id !== 4) {
        // Runtime error, TLE, etc.
        error = result.stderr || result.message || result.status.description;
      }

      results.push({
        test_case_id: tc.id,
        input: tc.input,
        expected_output: tc.expected_output,
        actual_output: actualOutput || null,
        passed,
        is_visible: tc.is_visible,
        error,
        status_description: passed ? "Accepted" : (error ? result.status.description : "Wrong Answer"),
      });
    } catch (err) {
      results.push({
        test_case_id: tc.id,
        input: tc.input,
        expected_output: tc.expected_output,
        actual_output: null,
        passed: false,
        is_visible: tc.is_visible,
        error: err instanceof Error ? err.message : "Unknown error",
        status_description: "Internal Error",
      });
    }
  }

  const allPassed = results.every((r) => r.passed);
  const verdict = allPassed
    ? "Accepted"
    : results.find((r) => r.error)?.status_description ?? "Wrong Answer";

  return { all_passed: allPassed, verdict, results, compile_error: compileError };
}
