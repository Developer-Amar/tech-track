"use client";

import { useState } from "react";
import { X, Sparkles, Save, UserCheck, AlertCircle, Loader2 } from "lucide-react";

export type EditableUserData = {
  id: string;
  name: string;
  email: string;
  roll_no: string | null;
  branch: string | null;
  semester: number | null;
  mobile_number: string | null;
  pass_code: string | null;
};

// Generate an 8-character unique alphanumeric pass code (excluding confusing 0/O, 1/I/L)
function generateLocalPassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function EditPassModal({
  user,
  onClose,
  onSaveSuccess,
}: {
  user: EditableUserData;
  onClose: () => void;
  onSaveSuccess: (updated: EditableUserData) => void;
}) {
  const [rollNo, setRollNo] = useState(user.roll_no ?? "");
  const [branch, setBranch] = useState(user.branch ?? "CSE");
  const [semester, setSemester] = useState<number | string>(user.semester ?? 4);
  const [mobileNumber, setMobileNumber] = useState(user.mobile_number ?? "");
  const [passCode, setPassCode] = useState(user.pass_code ?? generateLocalPassCode());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRegenerateCode() {
    setPassCode(generateLocalPassCode());
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const semNum = parseInt(String(semester), 10);

    const updates: Record<string, unknown> = {
      roll_no: rollNo.trim() || null,
      branch: branch.trim() || null,
      semester: isNaN(semNum) ? null : semNum,
      mobile_number: mobileNumber.trim() || null,
      pass_code: passCode.trim().toUpperCase() || null,
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          updates,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update user profile");
      } else {
        onSaveSuccess({
          ...user,
          roll_no: updates.roll_no as string | null,
          branch: updates.branch as string | null,
          semester: updates.semester as number | null,
          mobile_number: updates.mobile_number as string | null,
          pass_code: updates.pass_code as string | null,
        });
        onClose();
      }
    } catch {
      setError("Network error updating user details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 xs:p-4 select-none">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0e17] p-4 xs:p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#7DF9FF]/10 border border-[#7DF9FF]/30 text-[#7DF9FF]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                EDIT PASS & DETAILS
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Participant credentials and pass verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-only identity badges */}
        <div className="mt-4 p-3 rounded-xl border border-white/5 bg-void/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted block">
              NAME (READ-ONLY)
            </span>
            <span className="font-display text-base font-bold text-white uppercase">
              {user.name}
            </span>
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted block">
              CHITKARA EMAIL (READ-ONLY)
            </span>
            <span className="font-mono text-xs text-[#7DF9FF]">
              {user.email}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-red-400 font-mono text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSave} className="mt-5 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Roll Number */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted font-semibold mb-1">
                Roll Number
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g. 2110990000"
                className="w-full rounded-lg border border-white/10 bg-void/60 px-3 py-2 text-white placeholder:text-dormant/30 focus:border-[#7DF9FF] focus:outline-none transition-all"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted font-semibold mb-1">
                Mobile Number
              </label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full rounded-lg border border-white/10 bg-void/60 px-3 py-2 text-white placeholder:text-dormant/30 focus:border-[#7DF9FF] focus:outline-none transition-all"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted font-semibold mb-1">
                Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. CSE, AI, ECE"
                className="w-full rounded-lg border border-white/10 bg-void/60 px-3 py-2 text-white placeholder:text-dormant/30 focus:border-[#7DF9FF] focus:outline-none transition-all"
              />
            </div>

            {/* Semester */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted font-semibold mb-1">
                Semester (1–8)
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-void/60 px-3 py-2 text-white focus:border-[#7DF9FF] focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Pass Code Section with Regenerate Button */}
          <div className="pt-3 border-t border-white/10">
            <label className="block text-[10px] uppercase tracking-widest text-muted font-semibold mb-1">
              Event Pass Code (Scannable Barcode / QR ID)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={passCode}
                onChange={(e) => setPassCode(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="8-char code"
                className="flex-1 rounded-lg border border-[#7DF9FF]/40 bg-void/60 px-3 py-2 text-[#7DF9FF] font-mono text-sm tracking-widest uppercase focus:border-[#7DF9FF] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleRegenerateCode}
                className="btn-cyber-outline px-3 py-2 rounded-lg text-xs uppercase flex items-center gap-1.5 shrink-0 hover:bg-[#7DF9FF]/10"
                title="Generate new 8-character unique code"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#7DF9FF]" />
                <span>REGENERATE</span>
              </button>
            </div>
            <p className="mt-1 text-[9px] text-muted tracking-wider">
              Used on the attendee&apos;s physical and downloadable pass for QR/barcode scanning.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs uppercase font-mono text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-cyber px-5 py-2 rounded-lg text-xs uppercase font-mono font-semibold flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>SAVE DETAILS</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
