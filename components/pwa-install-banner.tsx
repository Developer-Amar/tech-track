"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running in standalone PWA mode
    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(Boolean(standaloneCheck));

    // Check if session was already dismissed
    if (sessionStorage.getItem("tt_pwa_dismissed") === "true") {
      setDismissed(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture standard PWA install prompt on Android / Chromium / Edge
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for appinstalled
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setTimeout(() => setDismissed(true), 3000);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("tt_pwa_dismissed", "true");
    } catch {}
  };

  // If already standalone app or dismissed or nothing to prompt, don't show
  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="rounded-2xl border border-signal/40 bg-black/90 p-4 shadow-[0_0_30px_rgba(0,229,255,0.25)] backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-signal/15 border border-signal/30 flex items-center justify-center text-signal shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-display text-sm font-bold uppercase tracking-wider">
                INSTALL TECH TREK
              </p>
              <p className="text-dormant font-mono text-[10px] leading-tight mt-0.5">
                {isIOS
                  ? "Tap Share (⎙) then 'Add to Home Screen' for full-screen mode."
                  : "Add to home screen for fullscreen offline-capable access."}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-dormant hover:text-white transition-colors p-1 -mr-1 -mt-1 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            disabled={installed}
            className="btn-cyber w-full py-2.5 px-4 rounded-xl text-xs uppercase font-display flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.3)] cursor-pointer"
          >
            {installed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>INSTALLED!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>INSTALL APP NOW</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}