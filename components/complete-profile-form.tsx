"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * CompleteProfileForm — Editable profile fields with Holographic Pass integration.
 *
 * Every focus, blur, keystroke, and submit event is forwarded to the
 * parent via onPassUpdate, which drives the holographic event pass.
 */
export default function CompleteProfileForm({
  name,
  email,
  onPassUpdate,
}: {
  name: string;
  email: string;
  onPassUpdate?: (update: {
    mobileNumber: string;
    rollNo: string;
    branch: string;
    semester: string;
    filledCount: number;
    isSubmitting: boolean;
    isSuccess: boolean;
    isError: boolean;
  }) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mobileNumber, setMobileNumber] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");

  // Compute filled count from current values
  const computeFilledCount = useCallback(
    (vals: { mobile: string; roll: string; br: string; sem: string }) => {
      return [vals.mobile, vals.roll, vals.br, vals.sem].filter(
        (v) => v.trim().length > 0
      ).length;
    },
    []
  );

  // Unified change handler
  const handleFieldChange = useCallback(
    (
      setter: (v: string) => void,
      newValue: string,
      field: "mobile" | "roll" | "branch" | "semester",
      currentValues: { mobile: string; roll: string; br: string; sem: string }
    ) => {
      setter(newValue);
      const updated = { ...currentValues };
      if (field === "mobile") updated.mobile = newValue;
      if (field === "roll") updated.roll = newValue;
      if (field === "branch") updated.br = newValue;
      if (field === "semester") updated.sem = newValue;

      onPassUpdate?.({
        mobileNumber: updated.mobile,
        rollNo: updated.roll,
        branch: updated.br,
        semester: updated.sem,
        filledCount: computeFilledCount(updated),
        isSubmitting: false,
        isSuccess: false,
        isError: false,
      });
    },
    [onPassUpdate, computeFilledCount]
  );

  // ── Form submission ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    onPassUpdate?.({
      mobileNumber,
      rollNo,
      branch,
      semester,
      filledCount: 4,
      isSubmitting: true,
      isSuccess: false,
      isError: false,
    });

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
      onPassUpdate?.({
        mobileNumber,
        rollNo,
        branch,
        semester,
        filledCount: computeFilledCount({
          mobile: mobileNumber,
          roll: rollNo,
          br: branch,
          sem: semester,
        }),
        isSubmitting: false,
        isSuccess: false,
        isError: true,
      });
      // Reset error after animation
      setTimeout(
        () =>
          onPassUpdate?.({
            mobileNumber,
            rollNo,
            branch,
            semester,
            filledCount: computeFilledCount({
              mobile: mobileNumber,
              roll: rollNo,
              br: branch,
              sem: semester,
            }),
            isSubmitting: false,
            isSuccess: false,
            isError: false,
          }),
        2500
      );
      return;
    }

    // Success
    onPassUpdate?.({
      mobileNumber,
      rollNo,
      branch,
      semester,
      filledCount: 4,
      isSubmitting: false,
      isSuccess: true,
      isError: false,
    });

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  const currentValues = {
    mobile: mobileNumber,
    roll: rollNo,
    br: branch,
    sem: semester,
  };

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

      {/* Editable fields */}
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
          onChange={(e) =>
            handleFieldChange(
              setMobileNumber,
              e.target.value,
              "mobile",
              currentValues
            )
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
          onChange={(e) =>
            handleFieldChange(
              setRollNo,
              e.target.value,
              "roll",
              currentValues
            )
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
            onChange={(e) =>
              handleFieldChange(
                setBranch,
                e.target.value,
                "branch",
                currentValues
              )
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
            onChange={(e) =>
              handleFieldChange(
                setSemester,
                e.target.value,
                "semester",
                currentValues
              )
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
        {loading ? "Building your pass..." : "Complete Registration"}
      </button>
    </form>
  );
}
