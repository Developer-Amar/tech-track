import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/audit
 * Returns the audit log, most recent first. Paginated via ?limit=50&offset=0
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const { data: logs, count } = await admin
    .from("audit_log")
    .select("id, actor_id, action_type, action_detail, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Resolve actor names
  const actorIds = Array.from(new Set((logs ?? []).map(l => l.actor_id)));
  const { data: actors } = actorIds.length > 0
    ? await admin.from("users").select("id, name, email").in("id", actorIds)
    : { data: [] };

  const actorMap = new Map((actors ?? []).map(a => [a.id, { name: a.name, email: a.email }]));

  const enriched = (logs ?? []).map(l => ({
    ...l,
    actor_name: actorMap.get(l.actor_id)?.name ?? "Unknown",
    actor_email: actorMap.get(l.actor_id)?.email ?? "",
  }));

  return NextResponse.json({ logs: enriched, total: count ?? 0 });
}
