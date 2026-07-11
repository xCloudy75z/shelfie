"use client";

import { useEffect, useState } from "react";

// Persistent light/dark toggle. The no-flash <head> script (in app/layout.tsx)
// already set data-theme before paint; this button just flips + persists it.
// Mirrors docs/theme.js.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync initial state from what the no-flash script put on <html>.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("shelfie-theme", next);
    } catch {
      /* ignore storage errors (private mode) */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}
