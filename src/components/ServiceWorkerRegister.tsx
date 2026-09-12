"use client";

import { useEffect } from "react";

/**
 * Register the service worker early so the app is installable.
 * Custom install UI lives in InstallAppButton (captures beforeinstallprompt).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") {
      // Still register in dev so installability can be tested on localhost.
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (reg) => {
        await navigator.serviceWorker.ready;
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        // Nudge updates so a new SW (folio-shell) takes over promptly.
        void reg.update();
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  return null;
}
