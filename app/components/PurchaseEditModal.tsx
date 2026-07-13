"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
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
}: {
  row: EditablePurchaseRow;
  onClose: () => void;
  onDone: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const downOnBackdrop = useRef(false);
  // Mirror `pending` into a ref so the once-bound Escape listener reads the
  // CURRENT value (a stale `pending=false` closure would let Escape close the
  // modal mid-save/delete).
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // Values the modal opened with — for the pristine close-guard.
  const initial = useRef<EditableFields>({
    price: row.priceAed,
    qty: String(row.quantity),
    store: row.store,
    date: row.purchasedAt,
    onOffer: row.onOffer,
  });
  const dirty = isPurchaseDirty(initial.current, { price, qty, store, date, onOffer });

  const previewFils = filsFromAed(price);

  // Keyboard-aware max height: track the visual viewport so the card stays
  // within the space above the iOS keyboard (top fields reachable, footer
  // visible). Falls back to 100dvh when visualViewport is unavailable.
  const [vh, setVh] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVh(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  // Scroll-lock + focus + Escape + background inert. Restore everything in the
  // cleanup so it runs however the modal unmounts (X, backdrop, Escape, Save/
  // Delete success, or a router.refresh() re-render).
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector(".app-shell");
    // Capture the element that opened the modal (the row button) BEFORE moving
    // focus, so we can restore it on close. May be <body> on iOS touch; the
    // isConnected guard handles the after-delete case where the row is gone.
    const trigger = document.activeElement as HTMLElement | null;
    shell?.setAttribute("inert", ""); // traps focus + blocks taps on toggle/tab bar/list behind the backdrop
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      // Escape = always close (like the ✕), but inert while a save/delete is
      // pending — read pendingRef, not the stale closure value.
      if (e.key === "Escape" && !pendingRef.current) onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      shell?.removeAttribute("inert"); // remove inert BEFORE restoring focus
      document.removeEventListener("keydown", onKey);
      if (trigger && trigger.isConnected) trigger.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fromBackdrop=true is the pristine-guarded path; ✕/Escape pass false (always close).
  function requestClose(fromBackdrop: boolean) {
    if (pending) return; // close paths inert while a save/delete is in flight
    if (fromBackdrop && dirty) return; // protect unsaved edits from an accidental outside tap
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
    requestClose(true);
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

  const cardMaxHeight = vh ? `${vh - 32}px` : "calc(100dvh - 32px)";

  return createPortal(
    <div
      style={backdrop}
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
            onClick={() => requestClose(false)}
            aria-label="Close"
            style={xBtn}
          >
            ✕
          </button>
        </div>

        {/* Body (scrolls) */}
        <div style={body}>
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
            <div style={{ width: "100%" }}>
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
                {pending ? "Saving…" : `Save · ${formatAed(previewFils)}`}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 16px", fontSize: 15, fontWeight: 700, background: "var(--card)", color: "var(--red)", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200, // above tab bar (50) + theme toggle (100); must occlude both
  background: "rgba(6,10,7,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start", // + card margin:auto = centered when it fits, top-reachable + scrollable when tall
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
  boxShadow: "var(--shadow)",
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
const body: CSSProperties = {
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
const xBtn: CSSProperties = {
  flex: "none",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  width: 38,
  height: 38,
  borderRadius: 10,
  fontSize: 16,
  cursor: "pointer",
};
