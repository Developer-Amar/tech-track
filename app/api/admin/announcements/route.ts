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
  const { data: announcements, error } = await admin
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Fetch announcements error:", error);
    return NextResponse.json({ announcements: [] });
  }

  // Resolve author names across both author_id and created_by
  const authorIds = Array.from(
    new Set((announcements ?? []).map((a: { author_id?: string; created_by?: string }) => a.author_id || a.created_by).filter(Boolean))
  );
  const { data: authors } = authorIds.length > 0
    ? await admin.from("users").select("id, name").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));

  const enriched = (announcements ?? [])
    .map((a: { id: string; content?: string; message?: string; priority?: string; created_at: string; author_id?: string; created_by?: string }) => ({
      id: a.id,
      content: a.content || a.message || "",
      priority: a.priority || "normal",
      created_at: a.created_at,
      author_id: a.author_id || a.created_by,
      author_name: authorMap.get(a.author_id || a.created_by || "") ?? "Staff Admin",
    }))
    .filter((a: { content: string }) => a.content && !a.content.startsWith("ide_smart_features:"));

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

  let body: { content?: string; message?: string; priority?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = (body.content || body.message || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const priority = body.priority || "normal";
  const admin = createAdminClient();

  // Populate both message & content, and created_by & author_id to guarantee all column constraints pass
  const { data: announcement, error } = await admin
    .from("announcements")
    .insert({
      message: text,
      content: text,
      created_by: user.id,
      author_id: user.id,
      priority,
    })
    .select()
    .single();

  if (error) {
    console.error("Announcement insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action_type: "create_announcement",
    action_detail: { message: text, content: text, priority },
  });

  return NextResponse.json({ success: true, announcement });
}

export async function DELETE() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Find system settings rows (e.g. ide_smart_features) to protect them from deletion
  const { data: sysSettings } = await admin
    .from("announcements")
    .select("id")
    .like("content", "ide_smart_features:%");

  const sysIds = (sysSettings ?? []).map((s: { id: string }) => s.id);

  let deleteQuery = admin.from("announcements").delete();
  if (sysIds.length > 0) {
    deleteQuery = deleteQuery.not("id", "in", `(${sysIds.join(",")})`);
  } else {
    deleteQuery = deleteQuery.neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { error } = await deleteQuery;
  if (error) {
    console.error("Clear announcements error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action_type: "reset_announcements",
    action_detail: { timestamp: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, message: "All announcements have been cleared." });
}
