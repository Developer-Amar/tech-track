import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

/**
 * Live System Heartbeat & Health Check Endpoint.
 *
 * 1. Performs an active query against Supabase DB to measure latency
 *    and keep the Supabase project active (prevents auto-pausing).
 * 2. Checks Judge0 API configuration / status.
 * 3. Returns structured telemetry for monitoring tools and GitHub cron.
 */
export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unreachable";
  let dbLatencyMs = -1;
  let judge0Status = "unconfigured";

  // 1. Ping Supabase Database
  try {
    const admin = createAdminClient();
    const dbStart = Date.now();
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
        },
        judge0: {
          status: judge0Status,
        },
      },
    },
    { status: isHealthy ? 200 : 500 }
  );
}
