/**
 * Auth route group layout.
 * Wraps /login and any future auth-related routes.
 * No sidebar, no dashboard chrome — just the auth flow.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
