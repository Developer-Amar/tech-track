/**
 * Admin route group layout.
 * Wraps all admin panel screens.
 * Auth guard (admin/super_admin role check) added in Phase 5.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
