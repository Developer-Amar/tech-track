import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/announcements — list all announcements
 * POST /api/admin/announcements — create announcement (admin/super_admin)
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: announcements } = await admin
    .from("announcements")
    .select("id, content, priority, created_at, author_id")
    .order("created_at", { ascending: false })
    .limit(20);

  // Resolve author names
  const authorIds = Array.from(new Set((announcements ?? []).map(a => a.author_id)));
  const { data: authors } = authorIds.length > 0
    ? await admin.from("users").select("id, name").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map(a => [a.id, a.name]));

  const enriched = (announcements ?? [])
    .filter(a => !a.content.startsWith("ide_smart_features:"))
    .map(a => ({
      ...a,
      author_name: authorMap.get(a.author_id) ?? "Unknown",
    }));

  return NextResponse.json({ announcements: enriched });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let body: { content: string; priority?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: announcement, error } = await admin
    .from("announcements")
    .insert({
      author_id: user.id,
      content: body.content.trim(),
      priority: body.priority || "normal",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action_type: "create_announcement",
    action_detail: { content: body.content.trim(), priority: body.priority || "normal" },
  });

  return NextResponse.json({ success: true, announcement });
}
