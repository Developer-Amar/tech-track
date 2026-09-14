import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

/**
 * Live System Heartbeat & Health Check Endpoint.
 *
 * 1. Read-only health ping by default (checks DB connectivity & latency).
 * 2. Active WRITE into heartbeat_log is gated behind CRON_SECRET or Service Role Auth
 *    to prevent unauthenticated write amplification/log table flooding (TT-05).
 * 3. Checks Judge0 API configuration / status.
 * 4. Disables client-side caching with explicit Cache-Control headers.
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  let dbStatus = "unreachable";
  let dbLatencyMs = -1;
  let judge0Status = "unconfigured";
  let heartbeatWritten = false;

  // Verify whether the caller is authorized to trigger active DB heartbeat writes
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  const expectedSecret = process.env.CRON_SECRET;
  const isAuthorizedWriter = Boolean(
    expectedSecret &&
      ((bearerToken && bearerToken === expectedSecret) ||
        (secretParam && secretParam === expectedSecret))
  );

  // 1. Ping Supabase Database — READ (always safe)
  try {
    const admin = createAdminClient();
    const dbStart = Date.now();

    // Read: verify connectivity without table mutations
    const { data, error } = await admin
      .from("event_settings")
      .select("id, event_live, registration_open")
      .eq("id", 1)
      .single();

    if (!error && data) {
      dbStatus = "connected";
      dbLatencyMs = Date.now() - dbStart;
    } else {
      dbStatus = `error: ${error?.message || "unknown"}`;
    }

    // Write: only insert heartbeat record if explicitly authorized via secret
    if (isAuthorizedWriter && dbStatus === "connected") {
      try {
        const { error: writeError } = await admin
          .from("heartbeat_log")
          .insert({
            service: "health-endpoint",
            status: "alive",
            latency_ms: dbLatencyMs,
          });

        if (!writeError) {
          heartbeatWritten = true;
        }
      } catch {
        // Non-fatal: heartbeat write failed but read succeeded
      }
    }
  } catch (err: any) {
    dbStatus = `exception: ${err?.message || "failed"}`;
  }

  // 2. Check Judge0 API Key presence
  if (process.env.JUDGE0_API_KEY && process.env.JUDGE0_API_URL) {
    judge0Status = "configured";
  }

  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      service: "tech-trek",
      timestamp: new Date().toISOString(),
      total_response_ms: Date.now() - startTime,
      telemetry: {
        database: {
          status: dbStatus,
          latency_ms: dbLatencyMs,
          heartbeat_written: heartbeatWritten,
          write_authorized: isAuthorizedWriter,
        },
        judge0: {
          status: judge0Status,
        },
      },
    },
    {
      status: isHealthy ? 200 : 500,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
