"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SentinelState } from "./sentinel";

/**
 * CompleteProfileForm — Editable profile fields with Sentinel integration.
 *
 * When `onSentinelUpdate` is provided, every focus, blur, keystroke,
 * and submit event is forwarded to the 3D Sentinel's state machine.
 * All existing form logic and API calls are preserved.
 */
export default function CompleteProfileForm({
  name,
  email,
  onSentinelUpdate,
}: {
  name: string;
  email: string;
  onSentinelUpdate?: (update: Partial<SentinelState>) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mobileNumber, setMobileNumber] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");

  // ── Sentinel integration helpers ──

  const handleFocus = useCallback(
    (fieldName: string) => {
      onSentinelUpdate?.({ mode: "focused", focusedField: fieldName });
    },
    [onSentinelUpdate]
  );

  const handleBlur = useCallback(() => {
    onSentinelUpdate?.({ mode: "idle", focusedField: null });
  }, [onSentinelUpdate]);

  /**
   * Unified change handler: updates field state, computes filled count,
   * and fires a sentinel keystroke pulse.
   */
  const handleFieldChange = useCallback(
    (
      setter: (v: string) => void,
      newValue: string,
      otherValues: string[]
    ) => {
      setter(newValue);
      const filled = [newValue, ...otherValues].filter(
        (v) => v.length > 0
      ).length;
      onSentinelUpdate?.({
        mode: "typing",
        keystrokeId: Date.now(),
        filledCount: filled,
      });
    },
    [onSentinelUpdate]
  );

  // ── Form submission ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    onSentinelUpdate?.({ mode: "submitting" });

    const res = await fetch("/api/profile/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile_number: mobileNumber,
        roll_no: rollNo,
        branch,
        semester: parseInt(semester, 10),
      }),
    });

    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: "Something went wrong" }));
      setError(data.error || "Something went wrong");
      setLoading(false);
      onSentinelUpdate?.({ mode: "error" });
      // Reset sentinel after error animation plays out
      setTimeout(() => onSentinelUpdate?.({ mode: "idle" }), 2500);
      return;
    }

    // Success — let the sentinel celebration animation play before redirecting
    onSentinelUpdate?.({ mode: "success" });
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left">
      {/* Read-only fields (pre-filled from Google OAuth) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-dormant mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            disabled
            className="w-full rounded-lg border border-dormant/20 bg-void/40 px-4 py-2.5 text-text/40 cursor-not-allowed font-body text-sm outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-dormant mb-1">
            Email
          </label>
          <input
            type="text"
            value={email}
            disabled
            className="w-full rounded-lg border border-dormant/20 bg-void/40 px-4 py-2.5 text-text/40 cursor-not-allowed font-mono text-xs outline-none"
          />
        </div>
      </div>

      <div className="h-px bg-dormant/10 my-4" />

      {/* Editable fields — each wired to the sentinel */}
      <div>
        <label
          htmlFor="mobile"
          className="block text-xs font-mono uppercase tracking-wider text-text mb-1.5"
        >
          Mobile Number
        </label>
        <input
          id="mobile"
          type="tel"
          required
          value={mobileNumber}
          onFocus={() => handleFocus("mobile")}
          onBlur={handleBlur}
          onChange={(e) =>
            handleFieldChange(setMobileNumber, e.target.value, [
              rollNo,
              branch,
              semester,
            ])
          }
          placeholder="e.g. 9876543210"
          className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
        />
      </div>

      <div>
        <label
          htmlFor="rollNo"
          className="block text-xs font-mono uppercase tracking-wider text-text mb-1.5"
        >
          University Roll No.
        </label>
        <input
          id="rollNo"
          type="text"
          required
          value={rollNo}
          onFocus={() => handleFocus("rollNo")}
          onBlur={handleBlur}
          onChange={(e) =>
            handleFieldChange(setRollNo, e.target.value, [
              mobileNumber,
              branch,
              semester,
            ])
          }
          placeholder="e.g. 2125XXX"
          className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="branch"
            className="block text-xs font-mono uppercase tracking-wider text-text mb-1.5"
          >
            Branch
          </label>
          <input
            id="branch"
            type="text"
            required
            value={branch}
            onFocus={() => handleFocus("branch")}
            onBlur={handleBlur}
            onChange={(e) =>
              handleFieldChange(setBranch, e.target.value, [
                mobileNumber,
                rollNo,
                semester,
              ])
            }
            placeholder="e.g. CSE"
            className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>

        <div>
          <label
            htmlFor="semester"
            className="block text-xs font-mono uppercase tracking-wider text-text mb-1.5"
          >
            Semester
          </label>
          <input
            id="semester"
            type="number"
            required
            min={1}
            max={10}
            value={semester}
            onFocus={() => handleFocus("semester")}
            onBlur={handleBlur}
            onChange={(e) =>
              handleFieldChange(setSemester, e.target.value, [
                mobileNumber,
                rollNo,
                branch,
              ])
            }
            placeholder="e.g. 3"
            className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>
      </div>

      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 p-3">
          <p className="text-danger text-xs font-mono">Error: {error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-cyber px-4 py-3 rounded-lg flex items-center justify-center gap-2 mt-6 uppercase text-sm"
      >
        {loading ? "Processing..." : "Save Details"}
      </button>
    </form>
  );
}
