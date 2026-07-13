"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { mergeItems, undoMerge } from "@/app/actions/merge";
import type { MergeUndo } from "@/lib/merge";

type ItemRef = { id: string; name: string };

const s = {
  linkBtn: {
    border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink-soft)",
    borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  field: {
    width: "100%", padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 10,
    fontSize: 15, background: "var(--card)", color: "var(--ink)", fontFamily: "inherit",
  },
  primaryBtn: {
    flex: 1, border: 0, borderRadius: 12, padding: "11px 12px", fontSize: 14, fontWeight: 700,
    color: "#fff", background: "var(--green)", cursor: "pointer",
  },
  softBtn: {
    flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "11px 12px",
    fontSize: 14, fontWeight: 700, background: "var(--card)", color: "var(--ink)", cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

export default function ItemMergeControl({
  currentItem,
  otherItems,
}: {
  currentItem: ItemRef;
  otherItems: ItemRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [otherId, setOtherId] = useState("");
  const [undo, setUndo] = useState<MergeUndo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const other = otherItems.find((i) => i.id === otherId) ?? null;
  const canMerge = otherItems.length > 0;

  // Nothing to show → render nothing. Placed AFTER all hooks (legal). Note the
  // Undo banner below is NOT gated on `canMerge`, so a merge that empties the
  // list (a 2-item account) still shows its confirmation + Undo (break-build P2).
  if (!canMerge && !undo && !error) return null;

  function run(survivorId: string, mergedId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await mergeItems(survivorId, mergedId);
      if ("error" in res) { setError(res.error); return; }
      setUndo(res.undo);
      setOpen(false);
      setOtherId("");
      router.push(`/prices?item=${survivorId}`);
    });
  }

  function doUndo() {
    if (!undo || pending) return;
    const snap = undo;
    setError(null);
    startTransition(async () => {
      const res = await undoMerge(snap);
      if ("error" in res) { setError(res.error); return; }
      setUndo(null);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 10 }}>
      {/* Persistent Undo banner — survives the post-merge navigation and is NOT
          time-boxed. Stays until Undo, dismiss, or the next merge. Rendered
          regardless of the item list, so a merge that leaves one item still
          shows it (break-build pass 2: F1 + F2). */}
      {undo && (
        <div
          role="status"
          style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 12px",
            borderRadius: 12, background: "var(--green-soft)", color: "var(--green-strong)",
            fontWeight: 600, fontSize: 14, border: "1px solid var(--line)",
          }}
        >
          <span>Merged ✓</span>
          <button
            type="button"
            onClick={doUndo}
            disabled={pending}
            style={{ marginLeft: "auto", ...s.softBtn, flex: "none", padding: "7px 14px", opacity: pending ? 0.6 : 1 }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setUndo(null)}
            aria-label="Dismiss"
            style={{ border: 0, background: "transparent", color: "var(--green-strong)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}
          >
            ✕
          </button>
        </div>
      )}

      {canMerge &&
        (!open ? (
          <button type="button" style={s.linkBtn} onClick={() => { setOpen(true); setError(null); }}>
            ⤵ Merge into another item…
          </button>
        ) : (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "var(--card-2)" }}>
            <label htmlFor="merge-with" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", margin: "0 2px 6px" }}>
              Merge <strong>{currentItem.name}</strong> with:
            </label>
            <select
              id="merge-with"
              autoFocus
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              style={s.field}
              aria-label="Item to merge with"
            >
              <option value="">Pick an item…</option>
              {otherItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>

            {other && (
              <>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "12px 2px 8px" }}>
                  Keep which name? The other item&apos;s purchases &amp; barcodes move over, then it&apos;s removed.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" disabled={pending} style={{ ...s.primaryBtn, opacity: pending ? 0.6 : 1 }} onClick={() => run(currentItem.id, other.id)}>
                    Keep “{currentItem.name}”
                  </button>
                  <button type="button" disabled={pending} style={{ ...s.primaryBtn, opacity: pending ? 0.6 : 1 }} onClick={() => run(other.id, currentItem.id)}>
                    Keep “{other.name}”
                  </button>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" style={s.softBtn} onClick={() => { setOpen(false); setOtherId(""); setError(null); }}>
                Cancel
              </button>
            </div>
          </div>
        ))}

      {error && <p style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, margin: "8px 2px 0" }}>{error}</p>}
    </div>
  );
}
