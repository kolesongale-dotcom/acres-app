-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BudgetEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "estimatedRevenue" REAL NOT NULL DEFAULT 0,
    "estimatedLaborCost" REAL NOT NULL DEFAULT 0,
    "estimatedPaintCost" REAL NOT NULL DEFAULT 0,
    "estimatedMaterialCost" REAL NOT NULL DEFAULT 0,
    "estimatedOverhead" REAL NOT NULL DEFAULT 0,
    "actualRevenue" REAL NOT NULL DEFAULT 0,
    "actualLaborCost" REAL NOT NULL DEFAULT 0,
    "actualPaintCost" REAL NOT NULL DEFAULT 0,
    "actualMaterialCost" REAL NOT NULL DEFAULT 0,
    "actualOverhead" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BudgetEntry" ("actualLaborCost", "actualMaterialCost", "actualOverhead", "actualRevenue", "createdAt", "estimateId", "estimatedLaborCost", "estimatedMaterialCost", "estimatedOverhead", "estimatedRevenue", "id", "notes", "updatedAt") SELECT "actualLaborCost", "actualMaterialCost", "actualOverhead", "actualRevenue", "createdAt", "estimateId", "estimatedLaborCost", "estimatedMaterialCost", "estimatedOverhead", "estimatedRevenue", "id", "notes", "updatedAt" FROM "BudgetEntry";
DROP TABLE "BudgetEntry";
ALTER TABLE "new_BudgetEntry" RENAME TO "BudgetEntry";
CREATE UNIQUE INDEX "BudgetEntry_estimateId_key" ON "BudgetEntry"("estimateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
