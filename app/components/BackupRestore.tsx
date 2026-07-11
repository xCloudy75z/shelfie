"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dubaiToday } from "@/lib/dates";
import { validateBackup, type BackupData, type BackupCounts } from "@/lib/backup";
import { buildBackup, markBackedUp, restoreBackup } from "@/app/actions/backup";

// Present an ISO instant in Dubai time, or a friendly "never" line.
function formatLastBackup(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

type Flow =
  | { step: "idle" }
  // A file passed validation and is waiting for the user to confirm the wipe.
  | { step: "confirm"; data: BackupData; counts: BackupCounts }
  // Restore done — we hold the pre-restore snapshot so Undo can replay it.
  | { step: "restored"; snapshot: BackupData }
  | { step: "undone" };

const btnBase: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "13px 18px",
  fontSize: 15,
  fontWeight: 700,
  background: "var(--card)",
  color: "var(--ink)",
  cursor: "pointer",
};

export default function BackupRestore({
  lastBackupAt,
}: {
  lastBackupAt: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "backup" | "restore" | "undo">("");
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow>({ step: "idle" });

  const lastLabel = formatLastBackup(lastBackupAt);

  async function backUpNow() {
    if (busy) return;
    setBusy("backup");
    setError(null);
    try {
      const data = await buildBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shelfie-backup-${dubaiToday(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await markBackedUp();
      router.refresh();
    } catch {
      setError("Couldn't create a backup. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    setError(null);
    setFlow({ step: "idle" });

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setError("This backup is corrupted or incomplete.");
      return;
    }
    const v = validateBackup(raw);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setFlow({ step: "confirm", data: v.data, counts: v.counts });
  }

  async function doRestore(data: BackupData) {
    setBusy("restore");
    setError(null);
    try {
      const res = await restoreBackup(data);
      if ("error" in res) {
        setError(res.error);
        setFlow({ step: "idle" });
        return;
      }
      setFlow({ step: "restored", snapshot: res.snapshot });
      router.refresh();
    } catch {
      setError("Restore failed. Nothing was changed.");
      setFlow({ step: "idle" });
    } finally {
      setBusy("");
    }
  }

  async function doUndo(snapshot: BackupData) {
    setBusy("undo");
    setError(null);
    try {
      const res = await restoreBackup(snapshot);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setFlow({ step: "undone" });
      router.refresh();
    } catch {
      setError("Undo failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div id="your-data">
      {/* Status line */}
      <p
        style={{
          fontSize: 13.5,
          color: lastBackupAt ? "var(--ink-soft)" : "var(--ink)",
          margin: "0 2px 12px",
          fontWeight: lastBackupAt ? 400 : 600,
        }}
      >
        {lastBackupAt ? (
          <>Last backed up: {lastLabel}</>
        ) : (
          <>🛟 Not backed up yet</>
        )}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={backUpNow}
          disabled={!!busy}
          style={{
            ...btnBase,
            background: "var(--green)",
            color: "#fff",
            border: 0,
            cursor: busy ? "wait" : "pointer",
            opacity: busy === "backup" ? 0.6 : 1,
          }}
        >
          {busy === "backup" ? "Preparing…" : "Back up now"}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          style={{ ...btnBase, opacity: busy ? 0.6 : 1 }}
        >
          Restore from file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFilePicked}
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <p
          style={{
            fontSize: 13.5,
            color: "var(--red)",
            background: "var(--red-soft)",
            borderRadius: 12,
            padding: "10px 12px",
            margin: "12px 0 0",
          }}
        >
          {error}
        </p>
      )}

      {/* Confirm the destructive replace. */}
      {flow.step === "confirm" && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "var(--card-2)",
          }}
        >
          <p style={{ fontSize: 13.5, color: "var(--ink)", margin: "0 0 12px" }}>
            This backup has <strong>{flow.counts.items}</strong> items,{" "}
            <strong>{flow.counts.purchases}</strong> purchases,{" "}
            <strong>{flow.counts.budgets}</strong> budgets. Replace everything
            currently in Shelfie? Your current data is snapshotted first, so you
            can Undo.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => doRestore(flow.data)}
              disabled={busy === "restore"}
              style={{
                ...btnBase,
                background: "var(--red)",
                color: "#fff",
                border: 0,
                cursor: busy === "restore" ? "wait" : "pointer",
                opacity: busy === "restore" ? 0.6 : 1,
              }}
            >
              {busy === "restore" ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              onClick={() => setFlow({ step: "idle" })}
              disabled={busy === "restore"}
              style={btnBase}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Restored — offer a one-tap Undo. */}
      {flow.step === "restored" && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 14px",
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "var(--green-soft)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
            Restored ✓
          </span>
          <button
            type="button"
            onClick={() => doUndo(flow.snapshot)}
            disabled={busy === "undo"}
            style={{
              ...btnBase,
              width: "auto",
              padding: "9px 16px",
              cursor: busy === "undo" ? "wait" : "pointer",
              opacity: busy === "undo" ? 0.6 : 1,
            }}
          >
            {busy === "undo" ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}

      {flow.step === "undone" && (
        <p
          style={{
            marginTop: 14,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          Undone ✓
        </p>
      )}
    </div>
  );
}
