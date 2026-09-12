"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Custom install affordance. Chrome only fires `beforeinstallprompt` when the
 * app meets installability criteria (HTTPS, manifest, SW, icons). We capture
 * that event so FOLIO can show an explicit “Install as app” control.
 */
export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIosHint(isIos());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        type="button"
        className="install-btn"
        onClick={async () => {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setDeferred(null);
        }}
      >
        Install as app
      </button>
    );
  }

  if (iosHint) {
    return (
      <div className="install-ios">
        <button
          type="button"
          className="install-btn"
          onClick={() => setShowIosHelp((v) => !v)}
        >
          Install as app
        </button>
        {showIosHelp ? (
          <p className="install-help muted tiny">
            On iPhone: tap Share → <strong>Add to Home Screen</strong>.
          </p>
        ) : null}
      </div>
    );
  }

  // Desktop Chrome may delay beforeinstallprompt until engagement criteria.
  return (
    <p className="install-fallback muted tiny">
      Install FOLIO from your browser menu when the option appears (Chrome:{" "}
      <em>Install app</em>).
    </p>
  );
}
