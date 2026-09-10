import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getIDESmartSetting } from "@/lib/ide-settings";
import AdminPanelClient from "@/components/admin/admin-panel-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  if (units && units.length > 0) {
    const leaderIds = Array.from(new Set(units.map((u) => u.leader_id)));
    const unitIds = units.map((u) => u.id);

    const [{ data: leaders }, { data: members }, { data: proctorStates }] = await Promise.all([
      admin.from("users").select("id, name").in("id", leaderIds),
      admin
        .from("unit_members")
        .select("unit_id")
        .in("unit_id", unitIds)
        .eq("status", "accepted"),
      admin
        .from("proctoring_state")
        .select("unit_id, round_number, tab_switches, tab_switch_limit, locked_out, ai_flags_count")
        .in("unit_id", unitIds),
    ]);

    const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l.name]));
    const memberCountMap = new Map<string, number>();
    for (const m of members ?? []) {
      memberCountMap.set(m.unit_id, (memberCountMap.get(m.unit_id) ?? 0) + 1);
    }

    const proctorMap = new Map<
      string,
      {
        proctor_locked: boolean;
        tab_switches: number;
        tab_switch_limit: number;
        ai_flags_count: number;
      }
    >();

    for (const ps of proctorStates ?? []) {
      const existing = proctorMap.get(ps.unit_id);
      if (!existing) {
        proctorMap.set(ps.unit_id, {
          proctor_locked: Boolean(ps.locked_out),
          tab_switches: ps.tab_switches ?? 0,
          tab_switch_limit: ps.tab_switch_limit ?? 3,
          ai_flags_count: ps.ai_flags_count ?? 0,
        });
      } else {
        existing.proctor_locked = existing.proctor_locked || Boolean(ps.locked_out);
        existing.tab_switches = Math.max(existing.tab_switches, ps.tab_switches ?? 0);
        existing.ai_flags_count = Math.max(existing.ai_flags_count, ps.ai_flags_count ?? 0);
      }
    }

    for (const unit of units) {
      const pInfo = proctorMap.get(unit.id);
      unitList.push({
        id: unit.id,
        name: unit.name,
        unit_type: unit.unit_type,
        locked: unit.locked,
        disqualified: unit.disqualified,
        leader_name: leaderMap.get(unit.leader_id) ?? "Unknown",
        member_count: memberCountMap.get(unit.id) ?? 0,
        proctor_locked: pInfo?.proctor_locked ?? false,
        tab_switches: pInfo?.tab_switches ?? 0,
        tab_switch_limit: pInfo?.tab_switch_limit ?? 3,
        ai_flags_count: pInfo?.ai_flags_count ?? 0,
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
