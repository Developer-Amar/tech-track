"use client";

import { useRef, useCallback, useState } from "react";
import html2canvas from "html2canvas";
import HolographicPass from "./holographic-pass";
import { Download } from "lucide-react";

/**
 * DownloadablePass — Renders the holographic event pass with a download button.
 * Uses html2canvas to capture the card as a PNG image.
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
  unitInfo?: { type: "solo" | "team"; name: string } | null;
}) {
  const passContainerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!passContainerRef.current) return;
    setDownloading(true);

    try {
      const canvas = await html2canvas(passContainerRef.current, {
        backgroundColor: "#05050F",
        scale: 3,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `tech-trek-pass-${passCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [passCode]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Pass preview — this div gets captured */}
      <div
        ref={passContainerRef}
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
        className="flex items-center gap-2 btn-cyber px-6 py-3 rounded-xl text-sm uppercase font-display tracking-wider disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {downloading ? "GENERATING..." : "DOWNLOAD EVENT PASS"}
      </button>

      <p className="text-dormant text-[9px] font-mono uppercase tracking-widest text-center max-w-xs">
        Save your pass and bring it to the event. Staff will scan your QR code for verification.
      </p>
    </div>
  );
}
