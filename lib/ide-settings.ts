import { createAdminClient } from "@/lib/supabase/server";

/**
 * Fetches the active IDE smart features setting from the announcements table (acting as system settings storage).
 * Returns true (enabled) by default.
 */
export async function getIDESmartSetting(): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("content")
    .like("content", "ide_smart_features:%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return true; // Default to true (smart features active)
  return data.content === "ide_smart_features:true";
}

/**
 * Sets the active IDE smart features setting by inserting a system configuration entry.
 */
export async function setIDESmartSetting(enabled: boolean, actorId: string): Promise<void> {
  const admin = createAdminClient();
  const value = `ide_smart_features:${enabled}`;

  await admin
    .from("announcements")
    .insert({
      author_id: actorId,
      content: value,
      priority: "normal",
    });
}
