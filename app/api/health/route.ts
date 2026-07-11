import { NextResponse } from "next/server";

/**
 * Health check endpoint.
 * Used by the keep-alive scheduled job (TRD Section 8) and
 * the uptime checker (TRD Section 10) to confirm the app is responding.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "tech-track",
    timestamp: new Date().toISOString(),
  });
}
