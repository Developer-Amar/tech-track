import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getIDESmartSetting } from "@/lib/ide-settings";
import RoundHeader from "@/components/event/round-header";
import RiddleChallenge from "@/components/event/riddle-challenge";
import CheckpointScan from "@/components/event/checkpoint-scan";
import CodeStepWrapper from "@/components/event/code-step-wrapper";
import EventWaiting from "@/components/event/event-waiting";
import EventComplete from "@/components/event/event-complete";
import Leaderboard from "@/components/event/leaderboard";
import Round2Arena from "@/components/event/round-2-arena";
import AnnouncementsBar from "@/components/event/announcements-bar";
import AnnouncementsModal from "@/components/announcements-modal";
import EventHoldingBay from "@/components/event-holding-bay";
import SignOutButton from "@/components/sign-out-button";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { Activity, LayoutDashboard, Trophy } from "lucide-react";

export const revalidate = 0; // Fresh state on every request

/**
 * Event page — Round-aware with Round 1 / Round 2 support
 */
export default async function EventPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    redirect("/dashboard");
  }

  const { data: unit } = await admin
    .from("units")
    .select("id, name, unit_type, locked, disqualified, payment_status, leader_id, payment_utr")
    .eq("id", membership.unit_id)
    .single();

  if (!unit) {
    redirect("/dashboard");
  }

  // Event settings — including round management columns and payment gating
  const { data: settings } = await admin
    .from("event_settings")
    .select("event_live, total_rounds, current_round_phase, round_1_stopped, round_2_active, round_2_stopped, require_payment_for_event, payment_upi_id, payment_payee_name, payment_deadline")
    .eq("id", 1)
    .single();

  const isPaymentRequired = settings?.require_payment_for_event ?? true;
  const isPaymentCleared = unit?.payment_status === "verified";
  const showHoldingBay =
    !["admin", "super_admin"].includes(profile.role) &&
    isPaymentRequired &&
    !isPaymentCleared;

  const totalRounds = settings?.total_rounds ?? 10;
  const roundPhase = settings?.current_round_phase ?? 1;
  const round1Stopped = settings?.round_1_stopped ?? false;
  const round2Active = settings?.round_2_active ?? false;
  const round2Stopped = settings?.round_2_stopped ?? false;

  // Check if team is qualified for Round 2
  const { data: qualifier } = await admin
    .from("round_qualifiers")
    .select("id")
    .eq("unit_id", membership.unit_id)
    .maybeSingle();
  const isQualified = !!qualifier;

  // Get checkpoints
  const { data: checkpoints } = await admin
    .from("checkpoints")
    .select("id, round_number, location_name")
    .order("round_number", { ascending: true });

  // Get progress
  const { data: allProgress } = await admin
    .from("round_progress")
    .select("checkpoint_id, status, points")
    .eq("unit_id", membership.unit_id);

  const progressMap = new Map(
    (allProgress ?? []).map((p) => [p.checkpoint_id, p])
  );

  let currentRound = 1;
  let currentStep: "riddle" | "checkpoint" | "code" = "riddle";
  let allDone = false;

  for (const cp of checkpoints ?? []) {
    const progress = progressMap.get(cp.id);

    if (!progress) {
      currentRound = cp.round_number;
      currentStep = "riddle";
      break;
    }

    if (progress.status === "passed" || progress.status === "skipped") {
      if (cp.round_number >= totalRounds) {
        allDone = true;
      }
      continue;
    }

    currentRound = cp.round_number;
    if (progress.status === "riddle_done") {
      currentStep = "checkpoint";
    } else if (progress.status === "checkpoint_done") {
      currentStep = "code";
    }
    break;
  }

  let riddleText = "";
  let locationName = "";
  let codingPrompt = "";
  let sampleInput = null;
  let sampleOutput = null;

  if (settings?.event_live && !allDone && !round1Stopped) {
    const activeCheckpoint = (checkpoints ?? []).find(
      (cp) => cp.round_number === currentRound
    );

    if (activeCheckpoint) {
      locationName = activeCheckpoint.location_name;

      if (currentStep === "riddle") {
        const { data: riddle } = await admin
          .from("riddles")
          .select("content")
          .eq("checkpoint_id", activeCheckpoint.id)
          .single();
        riddleText = riddle?.content ?? "No riddle configured for this round.";
      } else if (currentStep === "code") {
        const { data: question } = await admin
          .from("coding_questions")
          .select("prompt, sample_input, sample_output")
          .eq("checkpoint_id", activeCheckpoint.id)
          .single();

        codingPrompt = question?.prompt ?? "No coding challenge configured for this round.";
        sampleInput = question?.sample_input ?? null;
        sampleOutput = question?.sample_output ?? null;
      }
    }
  }

  /**
   * Leaderboard Visibility Rules:
   * - During Round 1: NO leaderboard visible to participants
   * - Round 1 closed: Round 1 leaderboard visible to ALL
   * - During Round 2: Round 1 leaderboard only (participants)
   * - Round 2 closed: Both leaderboards visible
   */
  const canSeeR1Leaderboard = round1Stopped;
  const canSeeR2Leaderboard = round2Stopped;
  const canSeeLeaderboardTab = canSeeR1Leaderboard;
  const showLeaderboard = searchParams.tab === "leaderboard" && canSeeLeaderboardTab;

  // Determine what to show for main content
  const showRound2Arena = round2Active && !round2Stopped && isQualified;
  const showRound1Complete = round1Stopped && !round2Active && !round2Stopped;
  const showRound1Active = settings?.event_live && !round1Stopped && !allDone;
  const showRound1Done = (allDone || round1Stopped) && !showRound2Arena;

  return (
    <main className="min-h-screen px-3 xs:px-4 sm:px-6 py-6 sm:py-8 relative z-10 select-none selection:bg-[#00E5FF] selection:text-black">
      <div className="mx-auto max-w-5xl">
        {/* Navigation HUD */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-white/5">
          <div>
            <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#00E5FF] font-semibold flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> EVENT PORTAL · IEI × IETE
            </span>
            <h1 className="font-display text-2xl xs:text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase mt-0.5">
              <KineticText delay={0.1}>TECH TREK</KineticText>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-start sm:justify-end">
            <AnnouncementsModal />
            {canSeeLeaderboardTab && (
              <a
                href={showLeaderboard ? "/event" : "/event?tab=leaderboard"}
                className="min-h-[44px] btn-cyber-outline px-3.5 sm:px-4 py-2 rounded-xl text-xs uppercase font-display flex items-center gap-2"
              >
                {showLeaderboard ? <><Activity className="w-4 h-4"/> Arena Terminal</> : <><Trophy className="w-4 h-4"/> View Leaderboard</>}
              </a>
            )}
            <a
              href="/dashboard"
              className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 px-3.5 sm:px-4 py-2 text-muted font-body text-xs transition-all duration-300 uppercase tracking-wider font-semibold flex items-center gap-2 backdrop-blur-sm"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </a>
            <SignOutButton />
          </div>
        </div>

        {/* Disqualified Panel */}
        {unit?.disqualified && (
          <BentoCard delay={0.2} glowColor="danger" className="p-8 text-center border-red-500/40 mb-8 bg-red-950/20">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse">
              <span className="font-mono text-3xl font-bold text-red-500">⚠️</span>
            </div>
            <h3 className="font-display text-4xl font-bold text-white uppercase mb-3">
              <KineticText delay={0.3}>DISQUALIFIED</KineticText>
            </h3>
            <p className="text-muted text-sm font-mono uppercase tracking-[0.2em]">
              Access Revoked. Please contact event coordinators.
            </p>
          </BentoCard>
        )}

        {/* Announcements */}
        {!unit?.disqualified && settings?.event_live && <AnnouncementsBar />}

        {/* Main Content Areas */}
        <div className="mt-8">
          {/* Leaderboard Tab */}
          {showLeaderboard && !unit?.disqualified && canSeeR1Leaderboard && (
            <div className="space-y-6">
              <Leaderboard round={1} />
              {canSeeR2Leaderboard && <Leaderboard round={2} />}
            </div>
          )}

          {/* Arena Content */}
          {!showLeaderboard && !unit?.disqualified && (
            showHoldingBay ? (
              <EventHoldingBay unit={unit} settings={settings || {}} currentUserId={user.id} />
            ) : (
            <div className="space-y-6">
              {/* Round 2 Arena for qualified teams */}
              {showRound2Arena ? (
                <Round2Arena unitId={membership.unit_id} />
              ) : !settings?.event_live && !round1Stopped ? (
                <EventWaiting />
              ) : showRound1Active ? (
                <div className="space-y-6">
                  <RoundHeader
                    round={currentRound}
                    totalRounds={totalRounds}
                    step={currentStep}
                  />

                  {currentStep === "riddle" && (
                    <RiddleChallenge
                      round={currentRound}
                      riddleText={riddleText}
                    />
                  )}

                  {currentStep === "checkpoint" && (
                    <CheckpointScan
                      round={currentRound}
                      locationName={locationName}
                    />
                  )}

                  {currentStep === "code" && (
                    <CodeStepWrapper
                      round={currentRound}
                      prompt={codingPrompt}
                      sampleInput={sampleInput}
                      sampleOutput={sampleOutput}
                      ideSmartFeatures={await getIDESmartSetting()}
                    />
                  )}
                </div>
              ) : showRound1Done ? (
                <div className="space-y-6">
                  <EventComplete totalRounds={totalRounds} />
                  {/* If Round 1 stopped and leaderboard visible, show inline */}
                  {canSeeR1Leaderboard && (
                    <div className="mt-8">
                      <Leaderboard round={1} />
                    </div>
                  )}
                  {/* Show Round 2 waiting message for non-qualified teams */}
                  {round2Active && !isQualified && (
                    <BentoCard delay={0.3} className="p-6 text-center">
                      <p className="font-mono text-sm text-dormant">
                        Round 2 is in progress for qualified teams. Your results are final.
                      </p>
                    </BentoCard>
                  )}
                  {canSeeR2Leaderboard && <Leaderboard round={2} />}
                </div>
              ) : (
                <EventWaiting />
              )}
            </div>
            )
          )}
        </div>
      </div>
    </main>
  );
}

