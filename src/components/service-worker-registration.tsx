"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) in production builds.
 * Also exposes install-prompt events via window (used by mobile install CTA).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const pending: Array<() => void> = [];
    const flush = () => {
      pending.forEach((fn) => fn());
      pending.length = 0;
    };

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // nothing to surface to the user
        })
        .catch(() => {
          // registration failure is non-fatal
        });
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      // stash event for a future install CTA
      (window as unknown as { __eqInstallPrompt?: Event }).__eqInstallPrompt = event;
    });

    return () => {
      // unregister only if we ever need to clean up old service workers
    };
  }, []);

  return null;
}
