"use client";

import SuperAdminPanel from "@/components/super-admin-panel";
import CloseRegistrationButton from "@/components/close-registration-button";
import BentoCard from "@/components/bento-card";
import { Settings, Lock, Unlock } from "lucide-react";

type UnitInfo = {
  id: string;
  name: string | null;
  unit_type: string;
  locked: boolean;
  disqualified: boolean;
  leader_name: string;
  member_count: number;
};

export default function SettingsPanel({
  registrationOpen,
  eventLive,
  units,
  ideSmartFeatures,
}: {
  registrationOpen: boolean;
  eventLive: boolean;
  units: UnitInfo[];
  ideSmartFeatures: boolean;
}) {
  return (
    <div className="space-y-6 text-left">
      {/* Registration control */}
      <BentoCard glowColor="danger" className="p-6 md:p-8 bg-black/40 border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:bg-red-500/10 group-hover:scale-110" />
        <h4 className="font-display text-2xl md:text-3xl font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-3">
          <Settings className="w-6 h-6 text-[#7DF9FF] animate-spin-slow" /> 
          Registration Settings
        </h4>
        
        {registrationOpen ? (
          <div className="space-y-4 relative z-10">
            <p className="text-muted text-sm md:text-base font-body leading-relaxed max-w-2xl bg-white/5 p-4 rounded-xl border border-white/10">
              <span className="flex items-center gap-2 text-white font-bold mb-2 uppercase tracking-widest text-xs">
                <Unlock className="w-4 h-4 text-green-400" /> STATUS: OPEN
              </span>
              Closing registration will <span className="text-red-400 font-semibold">lock all teams</span>, expire pending invites, convert unfilled teams to solo status, and generate verification codes. This action is irreversible.
            </p>
            <CloseRegistrationButton />
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted text-sm font-mono uppercase tracking-widest font-semibold bg-white/5 p-4 rounded-xl border border-white/10 w-fit">
            <Lock className="w-4 h-4 text-red-500" />
            REGISTRATION GATE IS SECURED & CLOSED
          </div>
        )}
      </BentoCard>

      {/* Super admin overrides */}
      <SuperAdminPanel
        registrationOpen={registrationOpen}
        eventLive={eventLive}
        units={units}
        ideSmartFeatures={ideSmartFeatures}
      />
    </div>
  );
}
