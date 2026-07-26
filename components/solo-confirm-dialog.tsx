"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SoloConfirmDialog({
  onCancel,
}: {
  onCancel: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/units/solo", { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="glass-panel border-danger/30 bg-danger/5 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-danger/5 rounded-full blur-xl pointer-events-none" />

      <p className="font-mono text-[9px] uppercase text-danger tracking-widest mb-1 font-semibold">WARNING: PERMANENT SELECTION</p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-2">
        GO SOLO?
      </h3>
      <p className="text-dormant text-sm font-body mb-2 leading-relaxed">
        This locks your registration immediately. You will compete on your own.
      </p>
      <p className="text-danger font-mono text-xs mb-6 uppercase tracking-wider font-semibold">
        ❌ Note: This is permanent. You cannot join a team later.
      </p>

      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 p-3 mb-4">
          <p className="text-danger text-xs font-mono">Error: {error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 btn-cyber-outline px-4 py-2.5 rounded-lg text-xs uppercase font-display"
        >
          BACK
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 rounded-lg bg-danger text-white hover:bg-danger/80 transition-all px-4 py-2.5 font-display font-semibold text-sm disabled:opacity-50 tracking-wider uppercase shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
        >
          {loading ? "LOCKING..." : "CONFIRM — GO SOLO"}
        </button>
      </div>
    </div>
  );
}
