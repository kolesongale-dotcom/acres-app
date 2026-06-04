-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN "completedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "globalTaxRate" REAL NOT NULL DEFAULT 0,
    "globalMarkupDefault" REAL NOT NULL DEFAULT 30,
    "standardTerms" TEXT NOT NULL DEFAULT '',
    "standardExclusions" TEXT NOT NULL DEFAULT '',
    "midDepositPercent" REAL NOT NULL DEFAULT 15,
    "midDepositDiscount" REAL NOT NULL DEFAULT 3,
    "maxDepositPercent" REAL NOT NULL DEFAULT 30,
    "maxDepositDiscount" REAL NOT NULL DEFAULT 6,
    "publicBaseUrl" TEXT NOT NULL DEFAULT '',
    "proposalEmailTemplate" TEXT NOT NULL DEFAULT 'Thank you for the opportunity to provide this estimate. Please find your proposal attached. We look forward to working with you.

Best,
Acres Painting Co.',
    "resourceInteriorUrl" TEXT NOT NULL DEFAULT '',
    "resourceExteriorUrl" TEXT NOT NULL DEFAULT '',
    "warrantyMonths" INTEGER NOT NULL DEFAULT 24
);
INSERT INTO "new_BusinessSettings" ("globalMarkupDefault", "globalTaxRate", "id", "maxDepositDiscount", "maxDepositPercent", "midDepositDiscount", "midDepositPercent", "proposalEmailTemplate", "publicBaseUrl", "resourceExteriorUrl", "resourceInteriorUrl", "standardExclusions", "standardTerms") SELECT "globalMarkupDefault", "globalTaxRate", "id", "maxDepositDiscount", "maxDepositPercent", "midDepositDiscount", "midDepositPercent", "proposalEmailTemplate", "publicBaseUrl", "resourceExteriorUrl", "resourceInteriorUrl", "standardExclusions", "standardTerms" FROM "BusinessSettings";
DROP TABLE "BusinessSettings";
ALTER TABLE "new_BusinessSettings" RENAME TO "BusinessSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
