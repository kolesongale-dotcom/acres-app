-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "changeOrderId" INTEGER;

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "changeOrderNumber" TEXT NOT NULL,
    "estimateId" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lineItemsJson" TEXT NOT NULL DEFAULT '[]',
    "total" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "signatureData" TEXT NOT NULL DEFAULT '',
    "signatureName" TEXT NOT NULL DEFAULT '',
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_changeOrderNumber_key" ON "ChangeOrder"("changeOrderNumber");
