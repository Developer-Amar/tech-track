"use client";

import { useState } from "react";
import AdminTabs from "@/components/admin/admin-tabs";
import StatsDashboard from "@/components/admin/stats-dashboard";
import UsersTable from "@/components/admin/users-table";
import UnitsTable from "@/components/admin/units-table";
import ContentEditor from "@/components/admin/content-editor";
import CheckpointCodesPanel from "@/components/checkpoint-codes-panel";
import SubmissionsTable from "@/components/admin/submissions-table";
import AuditLog from "@/components/admin/audit-log";
import SettingsPanel from "@/components/admin/settings-panel";
import SignOutButton from "@/components/sign-out-button";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { ShieldAlert, LayoutDashboard } from "lucide-react";

type UnitInfo = {
  id: string;
  name: string | null;
  unit_type: string;
  locked: boolean;
  disqualified: boolean;
  leader_name: string;
  member_count: number;
};

export default function AdminPanelClient({
  profileName,
  profileRole,
  registrationOpen,
  eventLive,
  units,
  ideSmartFeatures,
}: {
  profileName: string;
  profileRole: string;
  registrationOpen: boolean;
  eventLive: boolean;
  units: UnitInfo[];
  ideSmartFeatures: boolean;
}) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const isSuperAdmin = profileRole === "super_admin";

  return (
    <main className="min-h-screen px-4 py-8 relative z-10 select-none selection:bg-[#7DF9FF] selection:text-black">
      <div className="mx-auto max-w-6xl">
        {/* Navigation HUD header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 border-b border-white/5 pb-4">
          <div className="mb-4 sm:mb-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7DF9FF] font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> ADMIN CONTROL
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white uppercase mt-1">
              <KineticText delay={0.1}>ADMIN CENTER</KineticText>
            </h1>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <a
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 px-4 py-2 text-muted font-body text-xs transition-all duration-300 uppercase tracking-wider font-semibold flex items-center gap-2 backdrop-blur-sm"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </a>
            <SignOutButton />
          </div>
        </div>

        {/* User Identity HUD */}
        <p className="text-muted text-[10px] font-mono uppercase tracking-[0.2em] mb-8 bg-black/40 inline-block px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
          OPERATOR: <span className="text-white font-bold">{profileName}</span> · ROLE: <span className="text-[#7DF9FF] font-bold">{profileRole.replace("_", " ").toUpperCase()}</span>
        </p>

        {/* Tabs Control */}
        <div className="mb-6">
          <AdminTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isSuperAdmin={isSuperAdmin}
          />
        </div>

        {/* Tab content displays in Glassmorphic Wrapper */}
        <BentoCard glowColor="purple" className="p-6 md:p-8 relative overflow-hidden bg-black/40 border-white/5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#7DF9FF]/5 rounded-full blur-3xl pointer-events-none" />

          {activeTab === "dashboard" && <StatsDashboard />}
          {activeTab === "users" && <UsersTable isSuperAdmin={isSuperAdmin} />}
          {activeTab === "units" && <UnitsTable isSuperAdmin={isSuperAdmin} />}
          {activeTab === "content" && isSuperAdmin && <ContentEditor />}
          {activeTab === "codes" && <CheckpointCodesPanel />}
          {activeTab === "submissions" && <SubmissionsTable />}
          {activeTab === "audit" && isSuperAdmin && <AuditLog />}
          {activeTab === "settings" && isSuperAdmin && (
            <SettingsPanel
              registrationOpen={registrationOpen}
              eventLive={eventLive}
              units={units}
              ideSmartFeatures={ideSmartFeatures}
            />
          )}
        </BentoCard>
      </div>
    </main>
  );
}
