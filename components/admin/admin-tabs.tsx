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
    { key: "users", label: "Users" },
    { key: "units", label: "Teams" },
    { key: "content", label: "Content", superOnly: true },
    { key: "codes", label: "Codes" },
    { key: "submissions", label: "Submissions" },
    { key: "audit", label: "Audit Log", superOnly: true },
    { key: "settings", label: "Settings", superOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.superOnly || isSuperAdmin);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-signal/15">
      {visibleTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`whitespace-nowrap px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all duration-300 rounded border ${
            activeTab === tab.key
              ? "bg-signal/15 border-signal text-signal shadow-[0_0_12px_rgba(255,30,86,0.15)]"
              : "bg-void/40 border-dormant/15 text-dormant hover:border-dormant/30 hover:text-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
