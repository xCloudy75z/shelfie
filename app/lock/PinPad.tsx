"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPin, verifyPinAction } from "@/app/actions/auth";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function PinPad({ firstRun }: { firstRun: boolean }) {
  const router = useRouter();
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(value: string) {
    startTransition(async () => {
      setError("");
      try {
        if (firstRun) {
          // setPin redirects to /log on success (navigation happens automatically);
          // it only returns a value on validation failure.
          const res = await setPin(value);
          if (res && !res.ok) {
            setError(res.error);
            setPinValue("");
          }
        } else {
          const res = await verifyPinAction(value);
          if (res.ok) {
            router.replace("/log");
            router.refresh();
          } else {
            setError(res.error);
            setPinValue("");
          }
        }
      } catch (e) {
        // NEXT_REDIRECT from a successful setPin bubbles as a thrown control-flow
        // signal — let it propagate so navigation completes.
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
          throw e;
        }
        setError("Something went wrong. Try again.");
        setPinValue("");
      }
    });
  }

  function press(d: string) {
    if (pending) return;
    if (d === "⌫") {
      setPinValue((p) => p.slice(0, -1));
      setError("");
      return;
    }
    if (d === "") return;
    setPinValue((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) submit(next);
      return next;
    });
  }

  return (
    <div className="lock-screen">
      <div className="lock-cart">🛒</div>
      <div className="lock-logo">Shelfie</div>
      <div className="lock-hint">
        {firstRun ? "Create a 4-digit PIN" : "Enter your PIN"}
      </div>

      <div className="lock-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`lock-dot${i < pin.length ? " filled" : ""}`} />
        ))}
      </div>

      <div className={`lock-error${error ? " show" : ""}`}>{error || " "}</div>

      <div className="lock-pad">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} className="lock-key blank" />
          ) : (
            <button
              key={i}
              type="button"
              className="lock-key"
              onClick={() => press(k)}
              disabled={pending && k !== "⌫"}
              aria-label={k === "⌫" ? "Delete" : k}
            >
              {k}
            </button>
          ),
        )}
      </div>

      <style>{`
        .lock-screen {
          position: fixed; inset: 0; z-index: 80;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          color: #fff; text-align: center;
          background: linear-gradient(180deg, #0b3b28, #0f5138);
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .lock-cart { font-size: 40px; margin-bottom: 10px; }
        .lock-logo { font-size: 34px; font-weight: 600; letter-spacing: -.02em; margin-bottom: 2px; }
        .lock-hint { color: #bfe6d3; font-size: 13px; margin-bottom: 26px; }
        .lock-dots { display: flex; gap: 16px; margin-bottom: 14px; }
        .lock-dot {
          width: 15px; height: 15px; border-radius: 50%;
          border: 2px solid #7fd3ac; box-sizing: border-box; transition: .15s;
        }
        .lock-dot.filled { background: #fff; border-color: #fff; }
        .lock-error {
          min-height: 18px; margin-bottom: 16px; font-size: 13px; font-weight: 600;
          color: #ffd1cc; opacity: 0; transition: opacity .15s;
        }
        .lock-error.show { opacity: 1; }
        .lock-pad { display: grid; grid-template-columns: repeat(3, 72px); gap: 16px; }
        .lock-key {
          height: 72px; width: 72px; border-radius: 50%; border: 0;
          background: #ffffff1a; color: #fff; font-size: 26px; font-weight: 600;
          cursor: pointer; transition: background .12s;
        }
        .lock-key:active { background: #ffffff33; }
        .lock-key:disabled { opacity: .5; cursor: default; }
        .lock-key.blank { background: none; cursor: default; }
      `}</style>
    </div>
  );
}
