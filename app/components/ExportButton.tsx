"use client";

import { useState } from "react";
import { exportData } from "@/app/actions/purchases";
import { dubaiToday } from "@/lib/dates";

// Pulls a full JSON snapshot from the server and triggers a browser download.
// The file is named with today's Dubai date so repeated exports don't collide.
export default function ExportButton() {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shelfie-export-${dubaiToday(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      style={{
        width: "100%",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "13px 18px",
        fontSize: 15,
        fontWeight: 700,
        background: "var(--card)",
        color: "var(--ink)",
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Preparing…" : "Download my data"}
    </button>
  );
}
