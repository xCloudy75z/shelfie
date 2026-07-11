"use client";

import { useState } from "react";

// The build this bundle was compiled from — inlined at build time.
const RUNNING_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const BUILT_AT = process.env.NEXT_PUBLIC_BUILT_AT ?? "";

// Human-readable build time, always in Dubai time so it matches the rest of the app.
function formatBuiltAt(iso: string): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

type Update =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "latest" }
  | { state: "error" };

export default function VersionBar() {
  const [update, setUpdate] = useState<Update>({ state: "idle" });

  async function onTap() {
    // If we've already found a newer deploy, this tap performs the reload.
    if (update.state === "available") {
      await reloadToLatest();
      return;
    }

    setUpdate({ state: "checking" });
    try {
      const r = await fetch("/version", { cache: "no-store" }).then((x) => x.json());
      if (r.buildId && r.buildId !== RUNNING_BUILD_ID) {
        setUpdate({ state: "available" });
      } else {
        setUpdate({ state: "latest" });
        // Let the "You're on the latest" confirmation fade after a moment.
        setTimeout(() => setUpdate({ state: "idle" }), 2500);
      }
    } catch {
      setUpdate({ state: "error" });
      setTimeout(() => setUpdate({ state: "idle" }), 2500);
    }
  }

  async function reloadToLatest() {
    // Clear any service worker so the next load fetches fresh HTML/assets.
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (reg) => {
            try {
              await reg.update();
            } catch {
              /* ignore */
            }
            try {
              await reg.unregister();
            } catch {
              /* ignore */
            }
          }),
        );
      }
    } catch {
      /* ignore — reload anyway */
    }
    location.reload();
  }

  const label =
    update.state === "available"
      ? "Update available — tap to reload"
      : update.state === "checking"
        ? "Checking…"
        : update.state === "latest"
          ? "You're on the latest ✓"
          : update.state === "error"
            ? "Check failed — tap to retry"
            : "Update";

  const highlight = update.state === "available";

  return (
    <div className="card">
      <div className="card-kicker">App version</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
        }}
      >
        <span
          className="mono"
          style={{ color: "var(--ink-faint)", letterSpacing: "-0.01em" }}
        >
          {formatBuiltAt(BUILT_AT)} · {RUNNING_BUILD_ID}
        </span>
        <button
          type="button"
          onClick={onTap}
          style={{
            flex: "0 0 auto",
            border: highlight ? 0 : "1px solid var(--line)",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            background: highlight ? "var(--green)" : "var(--card)",
            color: highlight ? "#fff" : "var(--ink-soft)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
