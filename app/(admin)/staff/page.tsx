import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckpointCodesPanel from "@/components/checkpoint-codes-panel";
import BarcodeScanner from "@/components/barcode-scanner";
import ProctoringAlerts from "@/components/admin/proctoring-alerts";
import SignOutButton from "@/components/sign-out-button";

/**
 * Staff page — checkpoint staff can look up team codes for their checkpoint.
 * Accessible by checkpoint_staff, admin, and super_admin roles.
 */
export default async function StaffPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["checkpoint_staff", "admin", "super_admin"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-4 py-8 relative z-10 select-none">
      <div className="mx-auto max-w-2xl">
        {/* Header HUD */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 border-b border-white/10 pb-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-signal font-semibold">OUTPOST PANEL</span>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-white uppercase">
              STAFF PORTAL
            </h1>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {["admin", "super_admin"].includes(profile.role) && (
              <a
                href="/admin"
                className="btn-cyber-outline px-4 py-2 rounded-lg text-xs uppercase font-display"
              >
                ADMIN PANEL
              </a>
            )}
            <SignOutButton />
          </div>
        </div>

        <p className="text-dormant text-xs font-mono uppercase tracking-widest mb-6">
          OPERATIVE: {profile.name} · AUTHORITY: {profile.role?.replace("_", " ").toUpperCase()}
        </p>

        {/* Instructions */}
        <div className="glass-panel border-signal/20 bg-signal/5 p-5 mb-6 relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 right-0 w-8 h-8 bg-signal/5 rounded-bl-full pointer-events-none" />
          <p className="text-text text-sm font-body leading-relaxed">
            <strong>CHECKPOINT PROTOCOL:</strong> When a team arrives physically at your checkpoint station, scan their barcode or verify their identity, search their team name below, and read them the secret code for the correct round.
          </p>
        </div>

        {/* Barcode Scanner */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <h3 className="font-display text-lg font-bold text-text uppercase mb-3 tracking-wider flex items-center gap-2">
            <span className="text-signal">◆</span> BARCODE SCANNER
          </h3>
          <p className="text-dormant text-xs font-mono mb-4">Scan an event pass barcode or type the 8-character code to look up a participant.</p>
          <BarcodeScanner />
        </div>

        {/* Codes panel display */}
        <div className="glass-panel rounded-2xl p-6 mb-6">
          <CheckpointCodesPanel />
        </div>

        {/* Live proctoring alerts */}
        <div className="glass-panel border-danger/25 bg-danger/5 rounded-2xl p-6">
          <h3 className="font-display text-2xl font-bold text-text uppercase mb-4 tracking-wider">🔴 Active Proctoring Alerts</h3>
          <ProctoringAlerts compact />
        </div>
      </div>
    </main>
  );
}
