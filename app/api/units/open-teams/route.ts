import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/units/open-teams — List open teams that can be joined
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  // Check registration is open
  const { data: settings } = await admin.from("event_settings").select("registration_open").eq("id", 1).single();
  if (!settings?.registration_open) return NextResponse.json({ error: "Registration is closed." }, { status: 400 });

  // Get all unlocked, non-disqualified teams
  const { data: teams } = await admin.from("units").select(`
    id, name, leader_id,
    unit_members (user_id, status, users:user_id (name, email))
  `).eq("locked", false).eq("disqualified", false);

  // Filter to teams with < 4 accepted members
  const openTeams = (teams ?? []).filter(team => {
    const accepted = (team.unit_members as any[])?.filter((m: any) => m.status === 'accepted') ?? [];
    return accepted.length < 4;
  }).map(team => {
    const accepted = (team.unit_members as any[])?.filter((m: any) => m.status === 'accepted') ?? [];
    const leader = accepted.find((m: any) => m.user_id === team.leader_id);
    return {
      id: team.id,
      name: team.name,
      leader_name: (leader?.users as any)?.name ?? 'Unknown',
      member_count: accepted.length,
      members: accepted.map((m: any) => (m.users as any)?.name ?? 'Unknown'),
    };
  });

  // Check if current user already has pending requests
  const { data: userRequests } = await admin.from("unit_members").select("unit_id, status").eq("user_id", user.id).in("status", ["requested", "pending"]);
  const requestedTeams = new Set((userRequests ?? []).map(r => r.unit_id));

  return NextResponse.json({
    teams: openTeams,
    requested_team_ids: Array.from(requestedTeams),
  });
}
