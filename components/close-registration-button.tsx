"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseRegistrationButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/registration/close", {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn-cyber px-5 py-2.5 rounded-lg text-xs uppercase"
      >
        Close Registration
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-danger/35 bg-danger/5 p-4 mt-2">
      <p className="text-danger text-sm font-body mb-3">
        This will lock all teams, expire pending invites, and generate checkpoint verification codes. <strong>This action cannot be undone.</strong>
      </p>
      {error && <p className="text-danger text-xs font-mono mb-2">Error: {error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-xs font-mono bg-dormant/10 text-dormant hover:text-text uppercase tracking-widest font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={handleClose}
          disabled={loading}
          className="rounded-lg bg-danger hover:bg-danger/80 transition-all text-white px-4 py-2 text-xs font-mono uppercase tracking-widest font-semibold"
        >
          {loading ? "CLOSING..." : "YES, CLOSE REGISTRATIONS"}
        </button>
      </div>
    </div>
  );
}
