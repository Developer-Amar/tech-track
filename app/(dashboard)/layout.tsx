/**
 * Dashboard route group layout.
 * Wraps all participant-facing screens: dashboard, event gameplay, etc.
 * Auth guard and profile-completion gate will be added in Phase 2.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
