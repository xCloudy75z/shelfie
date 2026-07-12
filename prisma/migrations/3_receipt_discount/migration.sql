-- Add per-receipt discount (fils). Existing rows default to 0 (never captured before).
ALTER TABLE "ReceiptImport" ADD COLUMN "discountFils" INTEGER NOT NULL DEFAULT 0;
