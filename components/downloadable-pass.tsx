"use client";

import { useRef, useCallback, useState } from "react";
import HolographicPass from "./holographic-pass";
import { Download, CheckCircle, Loader2 } from "lucide-react";
import { generatePassBlob } from "@/lib/generate-pass-card";

/**
 * DownloadablePass — Renders the holographic event pass with a high-DPI canvas download.
 * Generates an instant high-resolution PNG with direct vector QR rendering.
 */
export default function DownloadablePass({
  name,
  email,
  avatarUrl,
  mobileNumber,
  rollNo,
  branch,
  semester,
  passCode,
  role,
  unitInfo,
}: {
  name: string;
  email: string;
  avatarUrl?: string;
  mobileNumber: string;
  rollNo: string;
  branch: string;
  semester: string;
  passCode: string;
  role?: string;
  unitInfo?: { name: string } | null;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setDownloadSuccess(false);

    try {
      const blob = await generatePassBlob({
        name,
        email,
        avatarUrl,
        mobileNumber,
        rollNo,
        branch,
        semester,
        passCode,
        role,
        unitInfo,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `tech-trek-pass-${passCode || "badge"}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error("Pass generation failed:", err);
      alert("Failed to generate pass. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [name, email, avatarUrl, mobileNumber, rollNo, branch, semester, passCode, role, unitInfo]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Pass preview */}
      <div
        style={{ padding: "20px", background: "#05050F", borderRadius: "20px" }}
      >
        <HolographicPass
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          mobileNumber={mobileNumber}
          rollNo={rollNo}
          branch={branch}
          semester={semester}
          passCode={passCode}
          role={role}
          unitInfo={unitInfo}
          filledCount={4}
          isSubmitting={false}
          isSuccess={false}
          isError={false}
        />
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`flex items-center justify-center gap-2.5 px-7 py-3 rounded-xl text-xs sm:text-sm uppercase font-display tracking-wider transition-all duration-300 select-none shadow-lg ${
          downloadSuccess
            ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-105"
            : downloading
            ? "bg-[#00E5FF]/20 border border-[#00E5FF] text-[#00E5FF] cursor-wait"
            : "btn-cyber hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        {downloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
            <span>GENERATING HIGH-RES PASS...</span>
          </>
        ) : downloadSuccess ? (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>PASS DOWNLOADED!</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>DOWNLOAD EVENT PASS (PNG)</span>
          </>
        )}
      </button>

      <p className="text-dormant text-[9px] font-mono uppercase tracking-widest text-center max-w-xs">
        Save your pass and bring it to the event. Staff will scan your QR code for verification.
      </p>
    </div>
  );
}
