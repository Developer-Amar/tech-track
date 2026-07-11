// Phase 0 verification script — tests Piston connectivity and shared-secret enforcement
//
// Usage:
//   npx tsx scripts/test-piston-health.ts
//
// Reads PISTON_API_URL and PISTON_SHARED_SECRET from .env.local in the
// project root.  Reports whether the Caddy proxy enforces the secret,
// Piston is reachable, and the required language runtimes are installed.

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// 1. Load environment variables from .env.local (manual parser — no dotenv dep)
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

const PISTON_API_URL = process.env.PISTON_API_URL?.replace(/\/+$/, "");
const PISTON_SHARED_SECRET = process.env.PISTON_SHARED_SECRET;

const missing: string[] = [];
if (!PISTON_API_URL) missing.push("PISTON_API_URL");
if (!PISTON_SHARED_SECRET) missing.push("PISTON_SHARED_SECRET");

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
  console.error("    PISTON_API_URL=http://<your-vm-ip>:2001");
  console.error("    PISTON_SHARED_SECRET=your-shared-secret-here");
  console.error("");
  console.error("  See infrastructure/README.md for full setup instructions.");
  console.error("");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Run checks
// ---------------------------------------------------------------------------

interface CheckResult {
  label: string;
  passed: boolean;
  detail: string;
}

interface Runtime {
  language: string;
  version: string;
  aliases?: string[];
}

async function runChecks(): Promise<void> {
  const RUNTIMES_URL = `${PISTON_API_URL}/api/v2/runtimes`;
  const results: CheckResult[] = [];

  // --- Check 1: Secret enforcement (request WITHOUT the header) ---------------

  try {
    const res = await fetch(RUNTIMES_URL, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 403) {
      results.push({
        label: "Secret enforcement",
        passed: true,
        detail: "Proxy correctly returned 403 when no secret was provided.",
      });
    } else if (res.status === 200) {
      results.push({
        label: "Secret enforcement",
        passed: false,
        detail:
          "Proxy returned 200 WITHOUT the secret header — the shared-secret " +
          "gate is NOT working.  Check the Caddyfile and ensure " +
          "PISTON_SHARED_SECRET is set in infrastructure/.env.",
      });
    } else {
      results.push({
        label: "Secret enforcement",
        passed: false,
        detail: `Unexpected status ${res.status} when calling without the secret header.`,
      });
    }
  } catch (err) {
    results.push({
      label: "Secret enforcement",
      passed: false,
      detail: `Could not reach ${RUNTIMES_URL} — ${(err as Error).message}`,
    });
  }

  // --- Check 2: Piston reachability (request WITH the header) -----------------

  let runtimes: Runtime[] = [];

  try {
    const res = await fetch(RUNTIMES_URL, {
      headers: { "X-Piston-Secret": PISTON_SHARED_SECRET! },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 200) {
      runtimes = (await res.json()) as Runtime[];
      if (Array.isArray(runtimes)) {
        results.push({
          label: "Piston reachable",
          passed: true,
          detail: `Piston returned ${runtimes.length} installed runtime(s).`,
        });
      } else {
        results.push({
          label: "Piston reachable",
          passed: false,
          detail: "Piston returned 200 but the body is not a JSON array.",
        });
        runtimes = [];
      }
    } else {
      const body = await res.text().catch(() => "");
      results.push({
        label: "Piston reachable",
        passed: false,
        detail: `Piston returned status ${res.status}. Body: ${body.slice(0, 200)}`,
      });
    }
  } catch (err) {
    results.push({
      label: "Piston reachable",
      passed: false,
      detail: `Could not reach ${RUNTIMES_URL} — ${(err as Error).message}`,
    });
  }

  // --- Check 3: Required language runtimes ------------------------------------

  const REQUIRED_LANGUAGES = [
    { display: "Python", match: (r: Runtime) => r.language === "python" },
    {
      display: "C (gcc)",
      match: (r: Runtime) =>
        r.language === "c" ||
        r.language === "gcc" ||
        (r.aliases ?? []).includes("gcc"),
    },
    {
      display: "C++ (g++)",
      match: (r: Runtime) =>
        r.language === "c++" ||
        r.language === "g++" ||
        r.language === "cpp" ||
        (r.aliases ?? []).includes("g++") ||
        (r.aliases ?? []).includes("cpp"),
    },
  ];

  if (runtimes.length > 0) {
    const missingLangs: string[] = [];
    const foundLangs: string[] = [];

    for (const req of REQUIRED_LANGUAGES) {
      if (runtimes.some(req.match)) {
        foundLangs.push(req.display);
      } else {
        missingLangs.push(req.display);
      }
    }

    if (missingLangs.length === 0) {
      results.push({
        label: "Required languages",
        passed: true,
        detail: `All required runtimes installed: ${foundLangs.join(", ")}.`,
      });
    } else {
      results.push({
        label: "Required languages",
        passed: false,
        detail:
          `Missing runtimes: ${missingLangs.join(", ")}. ` +
          `Install them with: docker compose exec piston /bin/sh -c "piston ppman install <lang>"`,
      });
    }
  } else {
    results.push({
      label: "Required languages",
      passed: false,
      detail: "Cannot check runtimes — Piston was not reachable (see above).",
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Print summary
  // ---------------------------------------------------------------------------

  console.log("");
  console.log("┌──────────────────────────────────────────────────────────────┐");
  console.log("│  Tech Track — Piston Health Check                           │");
  console.log("└──────────────────────────────────────────────────────────────┘");
  console.log("");
  console.log(`  Target: ${PISTON_API_URL}`);
  console.log("");

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
    console.log("  All checks passed — Piston is ready. 🚀");
  } else {
    console.log("  Some checks failed — see details above.");
  }
  console.log("");

  process.exit(allPassed ? 0 : 1);
}

runChecks();
