"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { canonicalizeBarcode } from "@/lib/barcode";

// Type-only reference to the lazily-imported class (no runtime/bundle impact).
type Html5QrcodeInstance = InstanceType<
  Awaited<typeof import("html5-qrcode")>["Html5Qrcode"]
>;

// Stop + release a scanner instance. Never throws (stop() rejects if not
// scanning, clear() if not stopped — both swallowed). Always operate on a
// CAPTURED instance, never a ref that another path may have nulled.
async function stopInstance(inst: Html5QrcodeInstance | null): Promise<void> {
  if (!inst) return;
  try { await inst.stop(); } catch { /* not scanning */ }
  try { inst.clear(); } catch { /* already cleared */ }
}

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const instRef = useRef<Html5QrcodeInstance | null>(null);
  const doneRef = useRef(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("Starting camera…");

  useEffect(() => {
    let cancelled = false;
    // Lock the background from scrolling while the full-screen scanner is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelBtnRef.current?.focus();

    (async () => {
      let inst: Html5QrcodeInstance | null = null;
      try {
        // Dynamic import — destructure BOTH the class AND the format enum so
        // nothing from html5-qrcode is statically imported (keeps it out of SSR
        // and the initial bundle).
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        inst = new Html5Qrcode("reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
          ],
          verbose: false,
        });
        instRef.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (doneRef.current) return;
            const canon = canonicalizeBarcode(decodedText);
            if (!canon) {
              setNote("That didn't look like a product barcode — try again");
              return;
            }
            doneRef.current = true;
            instRef.current = null;
            void stopInstance(inst); // stop the CAPTURED instance
            onDetected(canon);
          },
          () => {}, // per-frame no-match; ignore
        );
        // If the overlay was cancelled/unmounted while start() was resolving,
        // the camera is now live — release the CAPTURED instance (the ref may
        // already be nulled by close(), which is why we don't go through it).
        if (cancelled) {
          instRef.current = null;
          void stopInstance(inst);
          return;
        }
        setNote("Point the camera at a barcode");
      } catch (e) {
        if (cancelled) { void stopInstance(inst); return; }
        const name = e instanceof Error ? e.name : "";
        const msg = e instanceof Error ? e.message : String(e);
        const blob = name + " " + msg;
        if (/chunk|dynamically imported|import\(/i.test(blob)) {
          setError("Couldn't load the scanner — check your connection and try again.");
        } else if (/NotAllowed|Permission|denied/i.test(blob)) {
          setError("Camera access is blocked. Allow the camera for this app in Settings, then try again.");
        } else if (/NotFound|NotReadable|no camera/i.test(blob)) {
          setError("No usable camera was found. You can type the barcode instead.");
        } else {
          setError("Couldn't start the camera: " + msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      const inst = instRef.current;
      instRef.current = null;
      void stopInstance(inst);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    const inst = instRef.current;
    instRef.current = null;
    void stopInstance(inst);
    onClose();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <div style={bar}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{note}</span>
        <button ref={cancelBtnRef} type="button" onClick={close} aria-label="Cancel scanning" style={xBtn}>✕</button>
      </div>
      <div id="reader" style={reader} />
      {error && (
        <div style={errBox}>
          <p style={{ margin: "0 0 10px" }}>⚠ {error}</p>
          <button type="button" onClick={close} style={closeBtn}>Close</button>
        </div>
      )}
      <p style={privacy}>🔒 The camera stays on your phone — only the barcode number is used.</p>
    </div>,
    document.body,
  );
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 200, background: "rgba(6,10,7,0.94)",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
  padding: "max(env(safe-area-inset-top), 16px) 16px max(env(safe-area-inset-bottom), 16px)",
};
const bar: CSSProperties = {
  width: "100%", maxWidth: 420, display: "flex", alignItems: "center",
  justifyContent: "space-between", color: "#fff", marginBottom: 14, gap: 12,
};
const xBtn: CSSProperties = {
  border: "1px solid rgba(255,255,255,.4)", background: "transparent", color: "#fff",
  width: 38, height: 38, borderRadius: 10, fontSize: 18, cursor: "pointer", flex: "none",
};
const reader: CSSProperties = {
  width: "100%", maxWidth: 420, aspectRatio: "3 / 4", background: "#000",
  borderRadius: 16, overflow: "hidden",
};
const errBox: CSSProperties = {
  marginTop: 16, maxWidth: 420, width: "100%", background: "var(--red-soft)",
  border: "1px solid var(--red)", color: "var(--red)", borderRadius: 14, padding: 16,
  fontSize: 14, fontWeight: 600, textAlign: "center",
};
const closeBtn: CSSProperties = {
  border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 700, background: "var(--red)", color: "#fff", cursor: "pointer",
};
const privacy: CSSProperties = { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 16, textAlign: "center", maxWidth: 420 };
