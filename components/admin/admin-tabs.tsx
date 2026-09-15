"use client";

export default function AdminTabs({
  activeTab,
  onTabChange,
  isSuperAdmin,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isSuperAdmin: boolean;
}) {
  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "leaderboard", label: "Live Leaderboard" },
    { key: "users", label: "Users" },
    { key: "units", label: "Teams" },
    { key: "payments", label: "Payments" },
    { key: "rounds", label: "Rounds", superOnly: true },
    { key: "content", label: "Content", superOnly: true },
    { key: "codes", label: "Codes" },
    { key: "submissions", label: "Submissions" },
    { key: "audit", label: "Audit Log", superOnly: true },
    { key: "settings", label: "Settings", superOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.superOnly || isSuperAdmin);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-signal/15 touch-scroll no-scrollbar py-1">
      {visibleTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`min-h-[44px] whitespace-nowrap px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all duration-300 rounded-lg border flex items-center justify-center ${
            activeTab === tab.key
              ? "bg-signal/15 border-signal text-signal shadow-[0_0_12px_rgba(0,229,255,0.15)] font-bold"
              : "bg-void/50 border-white/[0.08] text-dormant hover:border-white/[0.15] hover:text-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

