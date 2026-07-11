import { describe, it, expect } from "vitest";
import {
  validateBackup,
  CURRENT_BACKUP_VERSION,
  type BackupData,
} from "@/lib/backup";

// A minimal, fully-valid backup we can clone and mutate per case.
function validRaw(): BackupData {
  return {
    app: "shelfie",
    schemaVersion: CURRENT_BACKUP_VERSION,
    exportedAt: "2026-07-11T10:00:00.000Z",
    items: [
      { name: "Milk", category: "Dairy" },
      { name: "Salt", category: null },
    ],
    purchases: [
      {
        itemName: "Milk",
        totalFils: 575,
        quantity: 1,
        unit: "each",
        store: "Carrefour",
        onOffer: false,
        purchasedAt: "2026-07-01T08:00:00.000Z",
        monthKey: "2026-07",
      },
    ],
    budgets: [{ monthKey: "2026-07", amountFils: 150000 }],
  };
}

describe("validateBackup — safety", () => {
  it("(1) rejects a foreign object that isn't a Shelfie backup", () => {
    const r = validateBackup({ app: "other", schemaVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("This isn't a Shelfie backup.");
  });

  it("rejects a non-object", () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup("nope").ok).toBe(false);
    const r = validateBackup([1, 2, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("This file isn't a readable backup.");
  });

  it("(2) rejects a backup from a newer schema version", () => {
    const raw = { ...validRaw(), schemaVersion: 999 };
    const r = validateBackup(raw);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.error).toBe(
        "This backup is from a newer version of Shelfie — update the app first.",
      );
  });

  it("treats a non-numeric schemaVersion as corrupt", () => {
    const r = validateBackup({ ...validRaw(), schemaVersion: "1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("This backup is corrupted or incomplete.");
  });

  it("(3a) rejects when items is not an array", () => {
    const r = validateBackup({ ...validRaw(), items: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("This backup is corrupted or incomplete.");
  });

  it("(3b) rejects a purchase missing totalFils", () => {
    const raw = validRaw();
    // Remove a required field.
    delete (raw.purchases[0] as Partial<BackupData["purchases"][number]>)
      .totalFils;
    const r = validateBackup(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("This backup is corrupted or incomplete.");
  });

  it("(3c) rejects a bad monthKey like 2026/7", () => {
    const raw = validRaw();
    raw.budgets[0].monthKey = "2026/7";
    const r = validateBackup(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("This backup is corrupted or incomplete.");
  });

  it("rejects a non-integer / negative totalFils", () => {
    const raw = validRaw();
    raw.purchases[0].totalFils = -5;
    expect(validateBackup(raw).ok).toBe(false);
    const raw2 = validRaw();
    raw2.purchases[0].totalFils = 5.5;
    expect(validateBackup(raw2).ok).toBe(false);
  });

  it("rejects a non-positive quantity and an unparseable date", () => {
    const raw = validRaw();
    raw.purchases[0].quantity = 0;
    expect(validateBackup(raw).ok).toBe(false);
    const raw2 = validRaw();
    raw2.purchases[0].purchasedAt = "not-a-date";
    expect(validateBackup(raw2).ok).toBe(false);
  });

  it("(4) accepts a booby-trapped record but strips unknown fields", () => {
    // Build with own __proto__ / id / script keys via JSON so they are real
    // enumerable own properties, not a prototype assignment.
    const raw = JSON.parse(
      JSON.stringify({
        app: "shelfie",
        schemaVersion: CURRENT_BACKUP_VERSION,
        exportedAt: "2026-07-11T10:00:00.000Z",
        items: [
          {
            name: "Milk",
            category: "Dairy",
            id: "hacked-id",
            script: "<img onerror=alert(1)>",
          },
        ],
        purchases: [
          {
            itemName: "Milk",
            totalFils: 575,
            quantity: 1,
            unit: "each",
            store: "Carrefour",
            onOffer: false,
            purchasedAt: "2026-07-01T08:00:00.000Z",
            monthKey: "2026-07",
            id: "evil",
          },
        ],
        budgets: [{ monthKey: "2026-07", amountFils: 150000, id: "evil" }],
      }),
    );
    // Also plant a prototype-pollution key on the item.
    raw.items[0].__proto__ = { polluted: true };

    const r = validateBackup(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("id" in r.data.items[0]).toBe(false);
      expect("script" in r.data.items[0]).toBe(false);
      expect("id" in r.data.purchases[0]).toBe(false);
      expect("id" in r.data.budgets[0]).toBe(false);
      // Nothing leaked onto Object.prototype.
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      // Known fields survived intact.
      expect(r.data.items[0]).toEqual({ name: "Milk", category: "Dairy" });
      expect(r.data.purchases[0].totalFils).toBe(575);
    }
  });

  it("(5) accepts a valid backup with correct counts", () => {
    const r = validateBackup(validRaw());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.counts).toEqual({ items: 2, purchases: 1, budgets: 1 });
      // Whitelisted copy — not the same reference as the input.
      expect(r.data.app).toBe("shelfie");
      expect(r.data.schemaVersion).toBe(CURRENT_BACKUP_VERSION);
      expect(r.data.items).toHaveLength(2);
      expect(r.data.budgets[0]).toEqual({ monthKey: "2026-07", amountFils: 150000 });
    }
  });
});
