"use client";

import TeamForm from "./team-form";

export default function RegistrationChoices({
  registrationOpen,
}: {
  registrationOpen: boolean;
}) {
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

  return <TeamForm onCancel={() => {}} />;
}
