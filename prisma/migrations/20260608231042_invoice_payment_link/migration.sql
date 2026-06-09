-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceNumber" TEXT NOT NULL,
    "estimateId" INTEGER NOT NULL,
    "proposalId" INTEGER,
    "tier" TEXT NOT NULL DEFAULT 'full',
    "tierLabel" TEXT NOT NULL DEFAULT '',
    "changeOrderId" INTEGER,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "lineItemsJson" TEXT NOT NULL DEFAULT '[]',
    "paymentLink" TEXT NOT NULL DEFAULT '',
    "dueDate" DATETIME NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Invoice" ("changeOrderId", "createdAt", "dueDate", "estimateId", "id", "invoiceNumber", "lineItemsJson", "notes", "proposalId", "subtotal", "tier", "tierLabel", "total", "updatedAt") SELECT "changeOrderId", "createdAt", "dueDate", "estimateId", "id", "invoiceNumber", "lineItemsJson", "notes", "proposalId", "subtotal", "tier", "tierLabel", "total", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_estimateId_key" ON "Invoice"("estimateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
