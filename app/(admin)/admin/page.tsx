import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getIDESmartSetting } from "@/lib/ide-settings";
import AdminPanelClient from "@/components/admin/admin-panel-client";

/**
 * Admin panel — server component fetches data, passes to client shell.
 */
export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Settings
  const { data: settings } = await admin
    .from("event_settings")
    .select("registration_open, event_live")
    .eq("id", 1)
    .single();

  // Units (for settings panel)
  const { data: units } = await admin
    .from("units")
    .select("id, name, unit_type, locked, disqualified, leader_id")
    .order("created_at", { ascending: false });

  const unitList = [];
  if (units) {
    for (const unit of units) {
      const { data: leader } = await admin
        .from("users")
        .select("name")
        .eq("id", unit.leader_id)
        .single();

      const { count } = await admin
        .from("unit_members")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", unit.id)
        .eq("status", "accepted");

      unitList.push({
        id: unit.id,
        name: unit.name,
        unit_type: unit.unit_type,
        locked: unit.locked,
        disqualified: unit.disqualified,
        leader_name: leader?.name ?? "Unknown",
        member_count: count ?? 0,
      });
    }
  }

  const ideSmartFeatures = await getIDESmartSetting();

  return (
    <AdminPanelClient
      profileName={profile.name}
      profileRole={profile.role}
      registrationOpen={settings?.registration_open ?? true}
      eventLive={settings?.event_live ?? false}
      units={unitList}
      ideSmartFeatures={ideSmartFeatures}
    />
  );
}
