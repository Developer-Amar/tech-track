import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Allowed domain patterns for Google profile photos
const ALLOWED_HOST_PATTERNS = [
  /^[a-z0-9-]+\.googleusercontent\.com$/i,
  /^googleusercontent\.com$/i,
  /^[a-z0-9-]+\.google\.com$/i,
  /^google\.com$/i,
];

function isAllowedGoogleHost(hostname: string): boolean {
  return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * GET /api/avatar?url=<encoded_google_avatar_url>
 *
 * Secure server-side avatar proxy. Eliminates client-side CORS, Referrer-Policy,
 * and Service Worker interference for Google profile pictures.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only HTTPS avatar URLs are supported" }, { status: 400 });
  }

  if (!isAllowedGoogleHost(parsedUrl.hostname)) {
    return NextResponse.json(
      { error: "Forbidden host: Only trusted Google profile domains are allowed" },
      { status: 403 }
    );
  }

  try {
    // Upstream request without client referrers
    const upstreamRes = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream image fetch failed with status ${upstreamRes.status}` },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get("content-type") || "image/png";
    const imageBuffer = await upstreamRes.arrayBuffer();

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: "Failed to proxy avatar image", details: message },
      { status: 502 }
    );
  }
}
