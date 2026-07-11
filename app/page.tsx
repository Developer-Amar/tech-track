/**
 * Tech Track — Landing Page (Hello World)
 *
 * Phase 0: bare deployment verification page.
 * The full landing page with the ambient node-field, staggered entrance
 * animations, and "Sign in with Google" CTA is built in Phase 2 (auth)
 * and polished in Phase 6 (visual).
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void">
      <h1 className="font-display text-5xl font-bold tracking-tight text-text mb-4">
        TECH TRACK
      </h1>
      <p className="font-body text-lg text-dormant max-w-md text-center mb-8">
        A campus-wide treasure hunt for people who&apos;d rather earn the answer
        than google it.
      </p>
      <div className="flex items-center gap-3 text-sm font-mono text-dormant">
        <span className="inline-block h-2 w-2 rounded-full bg-signal animate-pulse" />
        <span>IEI Club — Chitkara University</span>
      </div>
      <p className="mt-12 text-xs text-dormant/50 font-mono">
        Phase 0 — deployment verified
      </p>
    </main>
  );
}
