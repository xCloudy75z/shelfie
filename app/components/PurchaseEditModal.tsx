"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { updatePurchase, deletePurchase } from "@/app/actions/purchases";
import { filsFromAed, parsePriceFils, formatAed } from "@/lib/money";
import { isPurchaseDirty, type EditableFields } from "@/lib/purchase-edit";
import type { EditablePurchaseRow } from "@/app/components/EditablePurchases";

const STORES = ["Carrefour", "Lulu", "Union Coop", "Other"];

const s = {
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", margin: "12px 2px 6px" },
  field: { width: "100%", padding: "13px 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 16, background: "var(--card)", color: "var(--ink)", fontFamily: "inherit" },
  row: { display: "flex", gap: 10 },
  rowChild: { flex: 1, minWidth: 0 },
} satisfies Record<string, CSSProperties>;

export default function PurchaseEditModal({
  row,
  onClose,
  onDone,
  fallbackFocusRef,
}: {
  row: EditablePurchaseRow;
  onClose: () => void;
  onDone: () => void;
  /** Focused on close if the originating row is gone (e.g. after a delete). */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [price, setPrice] = useState(row.priceAed);
  const [qty, setQty] = useState(String(row.quantity));
  // NOTE: the <select> coerces an unknown/legacy store to "Other" for DISPLAY
  // ONLY; this state keeps the original value until the user actively changes
  // it, so Save never silently rewrites an untouched unknown store.
  const [store, setStore] = useState(row.store);
  const [date, setDate] = useState(row.purchasedAt);
  const [onOffer, setOnOffer] = useState(row.onOffer);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const downOnBackdrop = useRef(false);

  // Values the modal opened with — for the "did anything change?" guard.
  const initial = useRef<EditableFields>({
    price: row.priceAed,
    qty: String(row.quantity),
    store: row.store,
    date: row.purchasedAt,
    onOffer: row.onOffer,
  });
  const dirty = isPurchaseDirty(initial.current, { price, qty, store, date, onOffer });

  // Mirror the latest pending/dirty into refs so the once-bound Escape listener
  // reads CURRENT values (a stale closure would misbehave mid-request).
  const pendingRef = useRef(pending);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    pendingRef.current = pending;
    dirtyRef.current = dirty;
  });

  const priceValid = parsePriceFils(price) !== null;

  // Track the VISUAL viewport (position + size) so the modal lives in the area
  // actually visible above the iOS keyboard — both the top fields AND the Save
  // footer stay reachable. Sizing the card alone isn't enough: a position:fixed
  // backdrop covers the full LAYOUT viewport, so the card would center behind
  // the keyboard. We pin the backdrop box to the visual viewport instead.
  const [vp, setVp] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVp({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Scroll-lock + focus + Escape + background inert. Restore everything in the
  // cleanup so it runs however the modal unmounts (X, backdrop, Escape, Save/
  // Delete success, or a router.refresh() re-render).
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector(".app-shell");
    // Capture the element that opened the modal (the row button) BEFORE moving
    // focus, so we can restore it on close.
    const trigger = document.activeElement as HTMLElement | null;
    shell?.setAttribute("inert", ""); // traps focus + blocks taps on toggle/tab bar/list behind the backdrop
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      // Escape = same as ✕ (attempt close), inert while a save/delete is pending.
      if (e.key !== "Escape" || pendingRef.current) return;
      if (dirtyRef.current) setConfirmDiscard(true);
      else onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      shell?.removeAttribute("inert"); // remove inert BEFORE restoring focus
      document.removeEventListener("keydown", onKey);
      // Restore focus: the originating row if it still exists (survives an edit),
      // else the list container (row gone after a delete/month-move).
      if (trigger && trigger.isConnected) trigger.focus();
      else fallbackFocusRef?.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attempt to close: blocked while pending; if there are unsaved edits, ask
  // before discarding (so an accidental outside tap can't wipe them silently).
  function attemptClose() {
    if (pending) return;
    // If the delete-confirm is showing, an outside tap / ✕ / Escape just backs
    // out of it (never surprises the user with a discard prompt underneath).
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    if (dirty) {
      // Dismiss the keyboard so the centered discard pop-up is fully visible.
      (document.activeElement as HTMLElement | null)?.blur?.();
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function onBackdropPointerDown(e: React.PointerEvent) {
    downOnBackdrop.current = e.target === e.currentTarget;
  }
  function onBackdropClick(e: React.MouseEvent) {
    // Close only when the pointer BOTH went down and up on the backdrop itself.
    if (e.target !== e.currentTarget) return; // bubbled from card contents
    if (!downOnBackdrop.current) return; // drag started inside a field
    downOnBackdrop.current = false;
    attemptClose();
  }

  function save() {
    setError(null);
    if (parsePriceFils(price) === null) {
      setError("Enter a valid price above 0.");
      return;
    }
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof updatePurchase>>;
      try {
        res = await updatePurchase(row.id, {
          priceAed: price,
          quantity: parseFloat(qty) || 1,
          store,
          onOffer,
          purchasedAt: date,
        });
      } catch {
        setError("Could not save — please try again.");
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePurchase(row.id);
      } catch {
        setError("Could not delete — please try again.");
        return;
      }
      onDone();
    });
  }

  if (typeof document === "undefined") return null;

  const cardMaxHeight = vp ? `${vp.height - 32}px` : "calc(100dvh - 32px)";
  const geometry: CSSProperties = vp
    ? { position: "fixed", top: vp.top, left: 0, right: 0, height: vp.height }
    : { position: "fixed", inset: 0 };

  return createPortal(
    <div
      style={{ ...backdrop, ...geometry }}
      onPointerDown={onBackdropPointerDown}
      onClick={onBackdropClick}
    >
      <div
        style={{ ...card, maxHeight: cardMaxHeight }}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit purchase: ${row.itemName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (fixed) */}
        <div style={header}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.itemName}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Edit purchase</div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={attemptClose}
            aria-label="Close"
            style={xBtn}
          >
            ✕
          </button>
        </div>

        {/* Body (scrolls) */}
        <div style={bodyStyle}>
          <div style={s.row}>
            <div style={s.rowChild}>
              <label style={s.label}>Price (AED)</label>
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={s.field} />
            </div>
            <div style={s.rowChild}>
              <label style={s.label}>Qty</label>
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={s.field} />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.rowChild}>
              <label style={s.label}>Store</label>
              <select value={STORES.includes(store) ? store : "Other"} onChange={(e) => setStore(e.target.value)} style={s.field}>
                {STORES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div style={s.rowChild}>
              <label style={s.label}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={s.field} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>This was on offer</span>
            <button
              type="button"
              role="switch"
              aria-checked={onOffer}
              aria-label="This was on offer"
              onClick={() => setOnOffer((v) => !v)}
              style={{ width: 46, height: 28, borderRadius: 999, border: 0, padding: 0, position: "relative", cursor: "pointer", transition: "background .15s", background: onOffer ? "var(--green)" : "var(--line)", flex: "none" }}
            >
              <span style={{ position: "absolute", top: 3, left: onOffer ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
            </button>
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, margin: "12px 2px 0" }}>{error}</p>
          )}
        </div>

        {/* Footer (fixed, always visible) */}
        <div style={footer}>
          {confirmDelete ? (
            <div style={dangerBox}>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)" }}>Delete this purchase?</p>
              <div style={s.row}>
                <button type="button" disabled={pending} onClick={remove} style={{ flex: 1, border: 0, borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, background: "var(--red)", color: "#fff", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                  {pending ? "Deleting…" : "Delete"}
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirmDelete(false)} style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, background: "var(--card)", color: "var(--ink)", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ ...s.row, width: "100%" }}>
              <button type="button" disabled={pending} onClick={save} style={{ flex: 1, border: 0, borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, background: "var(--green)", color: "#fff", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                {pending ? "Saving…" : priceValid ? `Save · ${formatAed(filsFromAed(price))}` : "Save"}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 16px", fontSize: 15, fontWeight: 700, background: "var(--card)", color: "var(--red)", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmDiscard && (
        <div
          style={discardOverlay}
          role="presentation"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={discardCard} role="alertdialog" aria-modal="true" aria-label="Discard your changes?">
            <p style={discardTitle}>Discard your changes?</p>
            <p style={discardSub}>Your edits to this purchase won’t be saved.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setConfirmDiscard(false)} style={keepBtn}>
                Keep editing
              </button>
              <button type="button" onClick={onClose} style={discardBtn}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

const backdrop: CSSProperties = {
  zIndex: 200, // above tab bar (50) + theme toggle (100); must occlude both
  background: "rgba(6,10,7,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "max(env(safe-area-inset-top), 16px) 16px max(env(safe-area-inset-bottom), 16px)",
};
const card: CSSProperties = {
  width: "100%",
  maxWidth: "min(440px, 92vw)",
  margin: "auto",
  display: "flex",
  flexDirection: "column",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  // second layer = a faint light ring so the card separates from the dim in
  // dark mode (where --shadow is near-invisible against the near-black page).
  boxShadow: "var(--shadow), 0 0 0 1px rgba(255,255,255,0.06)",
  overflow: "hidden",
};
const header: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "18px 18px 12px",
  borderBottom: "1px solid var(--line)",
};
const bodyStyle: CSSProperties = {
  flex: "1 1 auto",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "4px 18px 16px",
};
const footer: CSSProperties = {
  flex: "none",
  display: "flex",
  padding: "14px 18px",
  borderTop: "1px solid var(--line)",
  background: "var(--card)",
};
const dangerBox: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  background: "var(--red-soft)",
  border: "1px solid var(--line)",
};
const xBtn: CSSProperties = {
  flex: "none",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  width: 44,
  height: 44,
  borderRadius: 12,
  fontSize: 16,
  cursor: "pointer",
};
// Centered discard confirmation — a real pop-up over the edit card (covers the
// whole modal area so it reads as a distinct prompt, not a footer line).
const discardOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  background: "rgba(6,10,7,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const discardCard: CSSProperties = {
  width: "100%",
  maxWidth: 320,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow), 0 0 0 1px rgba(255,255,255,0.06)",
  padding: 22,
  textAlign: "center",
};
const discardTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 19,
  fontWeight: 600,
  color: "var(--ink)",
};
const discardSub: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 13.5,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
};
const keepBtn: CSSProperties = {
  flex: 1,
  border: 0,
  borderRadius: 14,
  padding: 13,
  fontSize: 15,
  fontWeight: 700,
  background: "var(--green)",
  color: "#fff",
  cursor: "pointer",
};
const discardBtn: CSSProperties = {
  flex: 1,
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 13,
  fontSize: 15,
  fontWeight: 700,
  background: "var(--card)",
  color: "var(--red)",
  cursor: "pointer",
};
