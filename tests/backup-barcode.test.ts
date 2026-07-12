// tests/backup-barcode.test.ts
import { describe, it, expect } from "vitest";
import { validateBackup, CURRENT_BACKUP_VERSION } from "@/lib/backup";

const base = (over: any = {}) => ({
  app: "shelfie", schemaVersion: CURRENT_BACKUP_VERSION, exportedAt: new Date().toISOString(),
  items: [{ name: "Milk", category: "Dairy" }], purchases: [], budgets: [], barcodes: [], ...over,
});

// NOTE: match the ACTUAL ValidateResult shape in lib/backup.ts. Per the existing
// tests/backup.test.ts the success payload is `r.data` and access must be guarded
// by `if (r.ok)` (discriminated union) — NOT `r.value`.
describe("validateBackup barcodes", () => {
  it("keeps a valid barcode row", () => {
    const r = validateBackup(base({ barcodes: [{ code: "5000159407236", itemName: "Milk" }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.barcodes).toEqual([{ code: "05000159407236", itemName: "Milk" }]); // canonicalised
  });
  it("drops an invalid barcode (too short)", () => {
    const r = validateBackup(base({ barcodes: [{ code: "12", itemName: "Milk" }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.barcodes).toEqual([]);
  });
  it("drops duplicate codes within the file (keeps first)", () => {
    const r = validateBackup(base({ barcodes: [
      { code: "5000159407236", itemName: "Milk" },
      { code: "05000159407236", itemName: "Other" },
    ] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.barcodes).toHaveLength(1);
  });
  it("tolerates a missing barcodes array (old backup)", () => {
    const b = base(); delete (b as any).barcodes;
    const r = validateBackup(b);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.barcodes).toEqual([]);
  });
});
