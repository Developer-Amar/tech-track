import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import RegistrationChoices from "@/components/registration-choices";
import TeamRoster from "@/components/team-roster";
import LockedStatus from "@/components/locked-status";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import DownloadablePass from "@/components/downloadable-pass";
import JoinRequestsPanel from "@/components/join-requests-panel";
import LeaderTeamControls from "@/components/leader-team-controls";
import AnnouncementsModal from "@/components/announcements-modal";
import UserAvatar from "@/components/user-avatar";
import PaymentPortal from "@/components/payment-portal";
import { User, Activity, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dashboard page — Redesigned Legendary Carbon Dashboard
 */
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, role, pass_code, avatar_url, mobile_number, roll_no, branch, semester")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const adminSupabase = createAdminClient();

  // ── Fetch registration state ──────────────────────────────────────────
  const { data: settings } = await adminSupabase
    .from("event_settings")
    .select("registration_open, event_live")
    .eq("id", 1)
    .single();

  const registrationOpen = settings?.registration_open ?? true;

  // Find the user's accepted membership
  const { data: acceptedMembership } = await adminSupabase
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  // Find any pending invites
  const pendingInvites: {
    unit_id: string;
    team_name: string | null;
    leader_name: string;
  }[] = [];

  const { data: pendingMemberships } = await adminSupabase
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (pendingMemberships && pendingMemberships.length > 0) {
    const unitIds = pendingMemberships.map((pm) => pm.unit_id);
    const { data: inviteUnits } = await adminSupabase
      .from("units")
      .select("id, name, leader_id")
      .in("id", unitIds);

    if (inviteUnits && inviteUnits.length > 0) {
      const leaderIds = inviteUnits.map((u) => u.leader_id);
      const { data: leaders } = await adminSupabase
        .from("users")
        .select("id, name")
        .in("id", leaderIds);

      const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l.name]));

      for (const inviteUnit of inviteUnits) {
        pendingInvites.push({
          unit_id: inviteUnit.id,
          team_name: inviteUnit.name,
          leader_name: leaderMap.get(inviteUnit.leader_id) ?? "Someone",
        });
      }
    }
  }

  // Fetch unit details + roster
  let unitData: {
    id: string;
    unit_type: "team";
    name: string | null;
    leader_id: string;
    locked: boolean;
    members: {
      user_id: string;
      name: string;
      email: string;
      status: "pending" | "accepted" | "declined";
      is_leader: boolean;
    }[];
  } | null = null;

  if (acceptedMembership) {
    const { data: unit } = await adminSupabase
      .from("units")
      .select("id, unit_type, name, leader_id, locked")
      .eq("id", acceptedMembership.unit_id)
      .single();

    if (unit) {
      const { data: members } = await adminSupabase
        .from("unit_members")
        .select("user_id, status")
        .eq("unit_id", unit.id);

      const memberDetails = [];
      if (members) {
        for (const member of members) {
          const { data: memberUser } = await adminSupabase
            .from("users")
            .select("name, email")
            .eq("id", member.user_id)
            .single();

          memberDetails.push({
            user_id: member.user_id,
            name: memberUser?.name ?? "Unknown",
            email: memberUser?.email ?? "",
            status: member.status as "pending" | "accepted" | "declined",
            is_leader: member.user_id === unit.leader_id,
          });
        }
      }

      unitData = {
        id: unit.id,
        unit_type: unit.unit_type as "team",
        name: unit.name,
        leader_id: unit.leader_id,
        locked: unit.locked,
        members: memberDetails,
      };
    }
  }

  const isLeader = unitData?.leader_id === user.id;

  return (
    <main className="min-h-screen px-3 xs:px-4 sm:px-6 py-6 sm:py-12 relative z-10 selection:bg-[#00E5FF] selection:text-black">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 sm:mb-8 pb-4 select-none border-b border-white/5 gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="bg-white/95 p-2 sm:p-2.5 rounded-xl flex items-center gap-2.5 backdrop-blur-md shadow-sm">
              <Image src="/assets/chitkara-university-logo.png" alt="Chitkara University" width={130} height={36} className="object-contain h-8 sm:h-10 md:h-11 w-auto" />
              <div className="h-6 sm:h-7 w-px bg-black/15" />
              <div className="flex items-center gap-1.5">
                <Image src="/assets/IEI-logo.png" alt="IEI Club" width={36} height={36} className="object-contain h-7 sm:h-8.5 md:h-9 w-auto" />
                <span className="text-black font-mono text-[12px] font-bold">×</span>
                <Image src="/assets/IETE-logo.png" alt="IETE Club" width={36} height={36} className="object-contain h-7 sm:h-8.5 md:h-9 w-auto" />
              </div>
            </div>
            <div>
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#00E5FF] font-semibold flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> PARTICIPANT COMMAND · IEI × IETE
              </span>
              <h1 className="font-display text-2xl xs:text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase mt-0.5">
                <KineticText delay={0.1}>DASHBOARD</KineticText>
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-start md:justify-end">
            <AnnouncementsModal />
            {["admin", "super_admin"].includes(profile.role) && (
              <a
                href="/admin"
                className="min-h-[44px] flex items-center btn-cyber-outline px-4 sm:px-5 py-2.5 rounded-xl text-xs uppercase font-display tracking-widest"
              >
                ADMIN PANEL
              </a>
            )}
            <SignOutButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
          {/* User profile card */}
          <BentoCard className="md:col-span-12 p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 min-w-0" delay={0.2} glowColor="purple">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 border border-[#00E5FF]/30 shadow-[0_0_20px_rgba(125,249,255,0.15)] relative overflow-hidden group shrink-0">
              <UserAvatar src={profile.avatar_url} alt={profile.name} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] font-semibold">PARTICIPANT PROFILE</p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white uppercase mt-1 break-words">
                {profile.name}
              </h2>
              <p className="font-mono text-xs text-muted mt-1 truncate max-w-full overflow-hidden text-ellipsis">{profile.email}</p>
            </div>
          </BentoCard>

          {/* Main Content Area */}
          <div className="md:col-span-12 space-y-6">
            {/* Registration choices */}
            {!unitData ? (
              <BentoCard delay={0.4} className="p-1" glowColor="default">
                <RegistrationChoices registrationOpen={registrationOpen} pendingInvites={pendingInvites} />
              </BentoCard>
            ) : unitData.locked ? (
              <BentoCard delay={0.3} glowColor="signal" className="p-1">
                <LockedStatus
                  teamName={unitData.name}
                  members={unitData.members}
                />
              </BentoCard>
            ) : isLeader ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard delay={0.3} glowColor="purple" className="p-1">
                  <TeamRoster
                    unitId={unitData.id}
                    teamName={unitData.name ?? "Your Team"}
                    initialMembers={unitData.members}
                  />
                </BentoCard>
                <div className="space-y-6">
                  <LeaderTeamControls unitId={unitData.id} members={unitData.members} />
                  <JoinRequestsPanel unitId={unitData.id} />
                </div>
              </div>
            ) : (
              <BentoCard delay={0.3} glowColor="default" className="p-8 text-center flex flex-col items-center">
                <AlertCircle className="w-12 h-12 text-[#00E5FF] mb-4 opacity-80" />
                <p className="font-mono text-[10px] uppercase text-[#00E5FF] tracking-[0.2em] mb-2 font-semibold">TEAM SECURED</p>
                <h3 className="font-display text-3xl font-bold text-white uppercase mb-3">
                  {unitData.name ?? "Your Team"}
                </h3>
                <p className="text-muted text-sm font-body leading-relaxed max-w-md">
                  You have accepted the invite. Please wait for the leader to lock and finalize registration.
                </p>
              </BentoCard>
            )}

            {/* Operational Clearance & Payment Portal */}
            <PaymentPortal />

            {/* Event active/inactive portal link */}
            {Boolean(
              settings?.event_live &&
              (unitData?.locked || ["admin", "super_admin", "checkpoint_staff"].includes(profile.role))
            ) ? (
              <a href="/event" className="block">
                <BentoCard delay={0.5} glowColor="signal" className="p-6 sm:p-8 border border-[#00E5FF]/40 bg-[#00E5FF]/5 group cursor-pointer">
                  <div className="absolute top-6 right-6 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#00E5FF] animate-ping" />
                    <span className="h-3 w-3 rounded-full bg-[#00E5FF]" />
                  </div>
                  <h3 className="font-display text-2xl xs:text-3xl sm:text-4xl font-bold text-[#00E5FF] uppercase tracking-wider mb-2 sm:mb-3">
                    THE HUNT IS LIVE
                  </h3>
                  <p className="text-muted font-body text-sm sm:text-base leading-relaxed group-hover:text-white transition-colors duration-300">
                    The gates are open! Click here to enter the event arena.
                  </p>
                </BentoCard>
              </a>
            ) : (
              <BentoCard delay={0.5} glowColor="default" className="p-6 sm:p-8 opacity-75 flex flex-col items-center text-center">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-muted uppercase tracking-wider mb-2 sm:mb-3">
                  EVENT DORMANT
                </h3>
                <p className="text-muted text-sm font-body leading-relaxed max-w-sm">
                  {!settings?.event_live
                    ? "The hunt begins once the organizers start the countdown clock."
                    : !unitData
                    ? "Join or create a team to prepare for the live hunt arena."
                    : !unitData.locked
                    ? "Your team is registered! Registration must be locked (by your team leader or organizers) before entering the arena."
                    : "Access to arena will unlock momentarily."}
                </p>
              </BentoCard>
            )}

            {/* Download Event Pass — shown when:
                - Participants: team is locked
                - Admin/SuperAdmin/Staff: always (they don't need to lock) */}
            {profile.pass_code && (
              unitData?.locked || ["admin", "super_admin", "checkpoint_staff"].includes(profile.role)
            ) && (
              <BentoCard delay={0.45} glowColor="purple" className="p-2">
                <div className="text-center mb-2 pt-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#00E5FF] font-semibold">YOUR EVENT PASS</span>
                  <h3 className="font-display text-xl font-bold text-white uppercase mt-1">DOWNLOAD & SAVE</h3>
                </div>
                <DownloadablePass
                  name={profile.name}
                  email={profile.email}
                  avatarUrl={profile.avatar_url ?? undefined}
                  mobileNumber={profile.mobile_number ?? ""}
                  rollNo={profile.roll_no ?? ""}
                  branch={profile.branch ?? ""}
                  semester={String(profile.semester ?? "")}
                  passCode={profile.pass_code}
                  role={profile.role}
                  unitInfo={unitData ? { name: unitData.name ?? "Your Team" } : null}
                />
              </BentoCard>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
