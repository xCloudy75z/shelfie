"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

// SVG icons ported from docs/mockup.html.
const TABS: Tab[] = [
  {
    href: "/log",
    label: "Log",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/prices",
    label: "Prices",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
  },
  {
    href: "/month",
    label: "Month",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
