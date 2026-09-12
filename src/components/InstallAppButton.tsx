"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } finally {
        setDeferred(null);
        setBusy(false);
      }
      return;
    }
    if (isIos()) {
      setShowIosHelp(true);
      return;
    }
    // Chromium sometimes delays the event; still show guidance
    setShowIosHelp(false);
    alert(
      "Open this site in Chrome or Edge on your phone, then use the browser menu → Install app / Add to Home screen.",
    );
  }, [deferred]);

  if (installed) {
    return (
      <p className="install-status muted tiny">
        Installed as an app on this device.
      </p>
    );
  }

  return (
    <div className="install-block">
      <button
        type="button"
        className="install-btn"
        onClick={() => void install()}
        disabled={busy}
      >
        {busy ? "Installing…" : "Install as application"}
      </button>
      <p className="muted tiny install-hint">
        {deferred
          ? "Install PAPER on your home screen for offline reading."
          : isIos()
            ? "On iPhone: tap Share, then Add to Home Screen."
            : "Works best in Chrome / Edge. Tap to install or get instructions."}
      </p>

      {showIosHelp ? (
        <div className="install-sheet" role="dialog" aria-label="Install on iOS">
          <h3>Add to Home Screen</h3>
          <ol>
            <li>Tap the Share button in Safari</li>
            <li>Scroll and tap <strong>Add to Home Screen</strong></li>
            <li>Tap <strong>Add</strong></li>
          </ol>
          <button type="button" className="menu-dismiss" onClick={() => setShowIosHelp(false)}>
            Got it
          </button>
        </div>
      ) : null}
    </div>
  );
}
