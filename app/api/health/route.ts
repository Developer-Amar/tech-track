import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

/**
 * Live System Heartbeat & Health Check Endpoint.
 *
 * 1. Performs an active WRITE + READ against Supabase DB to guarantee
 *    the project registers as "active" (prevents auto-pausing).
 * 2. Checks Judge0 API configuration / status.
 * 3. Returns structured telemetry for monitoring tools and cron jobs.
 *
 * The WRITE operation (upsert into heartbeat_log) is critical:
 * Supabase may not count read-only SELECTs as "sufficient activity"
 * for their auto-pause detection. A write guarantees activity.
 */
export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unreachable";
  let dbLatencyMs = -1;
  let judge0Status = "unconfigured";
  let heartbeatWritten = false;

  // 1. Ping Supabase Database — READ + WRITE
  try {
    const admin = createAdminClient();
    const dbStart = Date.now();

    // Read: verify connectivity
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

    // Write: upsert a heartbeat record so Supabase definitely
    // registers this as "activity" for the pause-prevention check.
    // Uses a dedicated heartbeat_log table (single-row upsert).
    try {
      const { error: writeError } = await admin
        .from("heartbeat_log")
        .upsert(
          {
            id: 1,
            last_ping: new Date().toISOString(),
            source: "health-endpoint",
            ping_count: 1,
          },
          { onConflict: "id" }
        );

      if (!writeError) {
        heartbeatWritten = true;
        // Also increment ping_count
        try { await admin.rpc("increment_heartbeat_count"); } catch { /* non-fatal */ }
      }
    } catch {
      // Non-fatal: heartbeat write failed but read succeeded
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
        },
        judge0: {
          status: judge0Status,
        },
      },
    },
    { status: isHealthy ? 200 : 500 }
  );
}
