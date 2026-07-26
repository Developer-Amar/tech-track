"use client";

import { useState } from "react";
import SoloConfirmDialog from "./solo-confirm-dialog";
import TeamForm from "./team-form";

export default function RegistrationChoices({
  registrationOpen,
}: {
  registrationOpen: boolean;
}) {
  const [view, setView] = useState<"choose" | "solo" | "team">("choose");

  if (!registrationOpen) {
    return (
      <div className="glass-panel-danger rounded-xl p-6 border border-danger/30">
        <h3 className="font-display text-2xl font-bold text-danger mb-2 uppercase tracking-wide">
          REGISTRATION CLOSED
        </h3>
        <p className="text-dormant text-sm font-body">
          Registration has closed. New teams can no longer sign up.
        </p>
      </div>
    );
  }

  if (view === "solo") {
    return <SoloConfirmDialog onCancel={() => setView("choose")} />;
  }

  if (view === "team") {
    return <TeamForm onCancel={() => setView("choose")} />;
  }

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-full blur-xl pointer-events-none" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1 font-semibold">CHOOSE CONFLICT FORMAT</p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-2">
        LOCK REGISTRATION
      </h3>
      <p className="text-dormant text-sm font-body mb-6 leading-relaxed">
        Choose how you want to compete. Solo units lock immediately; teams wait for invited members to respond before locking.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setView("solo")}
          className="flex-1 btn-cyber-outline px-4 py-3 rounded-lg text-sm uppercase font-display"
        >
          GO SOLO
        </button>
        <button
          onClick={() => setView("team")}
          className="flex-1 btn-cyber px-4 py-3 rounded-lg text-sm uppercase"
        >
          FORM TEAM
        </button>
      </div>
    </div>
  );
}
