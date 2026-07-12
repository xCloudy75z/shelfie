-- CreateTable
CREATE TABLE "Barcode" (
    "code" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Barcode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "Barcode_itemId_idx" ON "Barcode"("itemId");

-- AddForeignKey
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
