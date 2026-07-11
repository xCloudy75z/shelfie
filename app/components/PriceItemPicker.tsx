"use client";

import { useRouter } from "next/navigation";
import { useTransition, type CSSProperties } from "react";

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 16,
  background: "var(--card)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

type Props = {
  items: { id: string; name: string }[];
  selectedId: string;
};

/**
 * Client item picker for the Prices tab. Selecting an item navigates
 * immediately (no "Show" button) so the server re-renders that item's price
 * story on change. The value reflects the current `?item` selection.
 */
export default function PriceItemPicker({ items, selectedId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ marginBottom: 14 }}>
      <select
        aria-label="Choose an item"
        value={selectedId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(() => {
            router.push(`/prices?item=${encodeURIComponent(id)}`);
          });
        }}
        style={{ ...selectStyle, opacity: pending ? 0.6 : 1 }}
      >
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </div>
  );
}
