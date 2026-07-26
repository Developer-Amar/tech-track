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
import AnnouncementsBar from "@/components/event/announcements-bar";
import SignOutButton from "@/components/sign-out-button";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { Activity, LayoutDashboard, Trophy } from "lucide-react";

export const revalidate = 0; // Fresh state on every request

/**
 * Event page — Redesigned Antigravity Bento Grid Layout
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
    .select("id, name, unit_type, locked, disqualified")
    .eq("id", membership.unit_id)
    .single();

  // Event settings
  const { data: settings } = await admin
    .from("event_settings")
    .select("event_live, total_rounds")
    .eq("id", 1)
    .single();

  const totalRounds = settings?.total_rounds ?? 3;

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

  if (settings?.event_live && !allDone) {
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

  const showLeaderboard = searchParams.tab === "leaderboard";

  return (
    <main className="min-h-screen px-4 py-8 relative z-10 select-none selection:bg-[#7DF9FF] selection:text-black">
      <div className="mx-auto max-w-5xl">
        {/* Navigation HUD */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-white/5">
          <div className="mb-4 sm:mb-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7DF9FF] font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" /> EVENT PORTAL
            </span>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-white uppercase mt-1">
              <KineticText delay={0.1}>TECH TREK</KineticText>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <a
              href={showLeaderboard ? "/event" : "/event?tab=leaderboard"}
              className="btn-cyber-outline px-4 py-2 rounded-xl text-xs uppercase font-display flex items-center gap-2"
            >
              {showLeaderboard ? <><Activity className="w-4 h-4"/> Arena Terminal</> : <><Trophy className="w-4 h-4"/> View Leaderboard</>}
            </a>
            <a
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 px-4 py-2 text-muted font-body text-xs transition-all duration-300 uppercase tracking-wider font-semibold flex items-center gap-2 backdrop-blur-sm"
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
          {showLeaderboard && !unit?.disqualified && <Leaderboard />}

          {!showLeaderboard && !unit?.disqualified && (
            <div className="space-y-6">
              {!settings?.event_live ? (
                <EventWaiting />
              ) : allDone ? (
                <EventComplete totalRounds={totalRounds} />
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
