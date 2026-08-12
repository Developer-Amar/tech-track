import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import RegistrationChoices from "@/components/registration-choices";
import InviteBanner from "@/components/invite-banner";
import TeamRoster from "@/components/team-roster";
import LockedStatus from "@/components/locked-status";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import DownloadablePass from "@/components/downloadable-pass";
import { User, Activity, AlertCircle } from "lucide-react";

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

  // ── Fetch registration state ──────────────────────────────────────────
  const { data: settings } = await supabase
    .from("event_settings")
    .select("registration_open, event_live")
    .eq("id", 1)
    .single();

  const registrationOpen = settings?.registration_open ?? true;

  // Find the user's accepted membership
  const { data: acceptedMembership } = await supabase
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  // Find any pending invites
  const adminSupabase = createAdminClient();

  let pendingInvite: {
    unit_id: string;
    team_name: string | null;
    leader_name: string;
  } | null = null;

  const { data: pendingMemberships } = await supabase
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingMemberships) {
    const { data: inviteUnit } = await adminSupabase
      .from("units")
      .select("id, name, leader_id")
      .eq("id", pendingMemberships.unit_id)
      .single();

    if (inviteUnit) {
      const { data: leader } = await adminSupabase
        .from("users")
        .select("name")
        .eq("id", inviteUnit.leader_id)
        .single();

      pendingInvite = {
        unit_id: inviteUnit.id,
        team_name: inviteUnit.name,
        leader_name: leader?.name ?? "Someone",
      };
    }
  }

  // Fetch unit details + roster
  let unitData: {
    id: string;
    unit_type: "solo" | "team";
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
    const { data: unit } = await supabase
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
        unit_type: unit.unit_type as "solo" | "team",
        name: unit.name,
        leader_id: unit.leader_id,
        locked: unit.locked,
        members: memberDetails,
      };
    }
  }

  const isLeader = unitData?.leader_id === user.id;

  return (
    <main className="min-h-screen px-4 py-12 relative z-10 selection:bg-[#7DF9FF] selection:text-black">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 select-none border-b border-white/5">
          <div className="mb-4 md:mb-0 flex items-center gap-4">
            <div className="bg-white/90 p-2 rounded flex items-center justify-center backdrop-blur-md hidden sm:flex">
              <Image src="/assets/chitkara-university-logo.png" alt="Chitkara University" width={150} height={40} className="object-contain h-10 w-auto" />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7DF9FF] font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" /> PARTICIPANT COMMAND
              </span>
              <h1 className="font-display text-4xl font-extrabold text-white tracking-tight uppercase mt-1">
                <KineticText delay={0.1}>DASHBOARD</KineticText>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {["admin", "super_admin"].includes(profile.role) && (
              <a
                href="/admin"
                className="btn-cyber-outline px-5 py-2.5 rounded-xl text-xs uppercase font-display tracking-widest"
              >
                ADMIN PANEL
              </a>
            )}
            <SignOutButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* User profile card */}
          <BentoCard className="md:col-span-12 p-6 md:p-8 flex items-center gap-6" delay={0.2} glowColor="purple">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 border border-[#7DF9FF]/30 shadow-[0_0_20px_rgba(125,249,255,0.15)] relative overflow-hidden group shrink-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-full h-full object-cover relative z-10"
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[#7DF9FF]/10 group-hover:bg-[#7DF9FF]/20 transition-colors duration-300" />
                  <User className="w-8 h-8 text-[#7DF9FF] relative z-10" />
                </>
              )}
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] font-semibold">PARTICIPANT PROFILE</p>
              <h2 className="font-display text-3xl font-extrabold text-white uppercase mt-1">
                {profile.name}
              </h2>
              <p className="font-mono text-xs text-muted mt-1">{profile.email}</p>
            </div>
          </BentoCard>

          {/* Main Content Area */}
          <div className="md:col-span-12 space-y-6">
            {/* Pending invite banner */}
            {!acceptedMembership && pendingInvite && (
              <BentoCard delay={0.3} glowColor="signal" className="border border-signal/20">
                <InviteBanner invite={pendingInvite} />
              </BentoCard>
            )}

            {/* Registration choices */}
            {!unitData ? (
              <BentoCard delay={0.4} className="p-1" glowColor="default">
                <RegistrationChoices registrationOpen={registrationOpen} />
              </BentoCard>
            ) : unitData.locked ? (
              <BentoCard delay={0.3} glowColor="signal" className="p-1">
                <LockedStatus
                  unitType={unitData.unit_type}
                  teamName={unitData.name}
                  members={unitData.members}
                />
              </BentoCard>
            ) : unitData.unit_type === "team" && isLeader ? (
              <BentoCard delay={0.3} glowColor="purple" className="p-1">
                <TeamRoster
                  unitId={unitData.id}
                  teamName={unitData.name ?? "Your Team"}
                  initialMembers={unitData.members}
                />
              </BentoCard>
            ) : (
              <BentoCard delay={0.3} glowColor="default" className="p-8 text-center flex flex-col items-center">
                <AlertCircle className="w-12 h-12 text-[#7DF9FF] mb-4 opacity-80" />
                <p className="font-mono text-[10px] uppercase text-[#7DF9FF] tracking-[0.2em] mb-2 font-semibold">TEAM SECURED</p>
                <h3 className="font-display text-3xl font-bold text-white uppercase mb-3">
                  {unitData.name ?? "Your Team"}
                </h3>
                <p className="text-muted text-sm font-body leading-relaxed max-w-md">
                  You have accepted the invite. Please wait for the leader to lock and finalize registration.
                </p>
              </BentoCard>
            )}

            {/* Event active/inactive portal link */}
            {unitData?.locked && settings?.event_live ? (
              <a href="/event" className="block">
                <BentoCard delay={0.5} glowColor="signal" className="p-8 border border-[#7DF9FF]/40 bg-[#7DF9FF]/5 group cursor-pointer">
                  <div className="absolute top-6 right-6 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#7DF9FF] animate-ping" />
                    <span className="h-3 w-3 rounded-full bg-[#7DF9FF]" />
                  </div>
                  <h3 className="font-display text-4xl font-bold text-[#7DF9FF] uppercase tracking-wider mb-3">
                    THE HUNT IS LIVE
                  </h3>
                  <p className="text-muted font-body text-base leading-relaxed group-hover:text-white transition-colors duration-300">
                    The gates are open! Click here to enter the event arena.
                  </p>
                </BentoCard>
              </a>
            ) : (
              <BentoCard delay={0.5} glowColor="default" className="p-8 opacity-60 flex flex-col items-center text-center">
                <h3 className="font-display text-2xl font-bold text-muted uppercase tracking-wider mb-3">
                  EVENT DORMANT
                </h3>
                <p className="text-muted text-sm font-body leading-relaxed max-w-sm">
                  {!unitData?.locked
                    ? "Ensure registration is locked to initialize verification access."
                    : "The hunt begins once the organizers start the countdown clock."}
                </p>
              </BentoCard>
            )}

            {/* Download Event Pass — shown when locked */}
            {unitData?.locked && profile.pass_code && (
              <BentoCard delay={0.45} glowColor="purple" className="p-2">
                <div className="text-center mb-2 pt-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7DF9FF] font-semibold">YOUR EVENT PASS</span>
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
                />
              </BentoCard>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
