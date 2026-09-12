"use client";

import { useEffect } from "react";

/**
 * Register the service worker as early as possible so Chrome can treat the
 * site as installable and show its own install UI (omnibox / Android banner).
 * Do NOT call preventDefault on beforeinstallprompt — that hides Chrome's UI.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (reg) => {
        await navigator.serviceWorker.ready;
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  return null;
}
