"use client";

import { useEffect } from "react";

// Registers the network-first service worker so the app is installable and
// always loads the latest deploy. Production only — a dev SW would fight HMR.
// Renders nothing.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works without it */
      });
    }
  }, []);

  return null;
}
