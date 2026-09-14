"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register after initial page load to avoid competing with main thread resources
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // Check for service worker updates
            reg.addEventListener("updatefound", () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.addEventListener("statechange", () => {
                  if (
                    installingWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                  ) {
                    console.log("⚡ Tech Trek: New version available. Reload to update.");
                  }
                });
              }
            });
          })
          .catch((err) => {
            // Service worker registration error (e.g. non-HTTPS local IP)
            console.debug("PWA service worker registration bypassed:", err);
          });
      });
    }
  }, []);

  return null;
}