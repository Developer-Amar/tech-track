/**
 * Piston code judge client — wraps HTTP calls to the self-hosted Piston instance.
 *
 * IMPORTANT: This module runs SERVER-SIDE ONLY. It uses PISTON_API_URL and
 * PISTON_SHARED_SECRET, which must never reach client-side code.
 *
 * Built in Phase 4 (Event Engine).
 */

const PISTON_API_URL = process.env.PISTON_API_URL!;
const PISTON_SHARED_SECRET = process.env.PISTON_SHARED_SECRET!;

/** Language identifiers accepted by our platform, mapped to Piston runtime names. */
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  c: { language: "c", version: "*" },
  cpp: { language: "c++", version: "*" },
  python: { language: "python", version: "*" },
};

export interface PistonExecuteRequest {
  language: "c" | "cpp" | "python";
  code: string;
  stdin?: string;
}

export interface PistonExecuteResponse {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
  };
}

/**
 * Execute code against the self-hosted Piston instance.
 * Includes the shared-secret header and explicit resource limits per TRD Section 5.
 */
export async function executeCode(
  request: PistonExecuteRequest
): Promise<PistonExecuteResponse> {
  const runtime = LANGUAGE_MAP[request.language];
  if (!runtime) {
    throw new Error(`Unsupported language: ${request.language}`);
  }

  const response = await fetch(`${PISTON_API_URL}/api/v2/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Piston-Secret": PISTON_SHARED_SECRET,
    },
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      files: [{ content: request.code }],
      stdin: request.stdin ?? "",
      // Explicit resource limits — TRD Section 5
      run_timeout: 5000, // 5s run timeout
      compile_timeout: 10000, // 10s compile timeout
      memory_limit: 256_000_000, // 256 MB
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Piston execution failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
