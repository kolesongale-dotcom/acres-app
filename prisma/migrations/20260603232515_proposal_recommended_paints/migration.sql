-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Proposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalNumber" TEXT NOT NULL,
    "estimateId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "selectedTier" TEXT NOT NULL DEFAULT 'full',
    "customNotes" TEXT NOT NULL DEFAULT '',
    "includedSOPs" TEXT NOT NULL DEFAULT '[]',
    "signatureData" TEXT NOT NULL DEFAULT '',
    "signatureName" TEXT NOT NULL DEFAULT '',
    "signedAt" DATETIME,
    "sentAt" DATETIME,
    "viewedAt" DATETIME,
    "recommendedPaints" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Proposal" ("createdAt", "customNotes", "estimateId", "id", "includedSOPs", "proposalNumber", "selectedTier", "sentAt", "signatureData", "signatureName", "signedAt", "status", "updatedAt", "viewedAt") SELECT "createdAt", "customNotes", "estimateId", "id", "includedSOPs", "proposalNumber", "selectedTier", "sentAt", "signatureData", "signatureName", "signedAt", "status", "updatedAt", "viewedAt" FROM "Proposal";
DROP TABLE "Proposal";
ALTER TABLE "new_Proposal" RENAME TO "Proposal";
CREATE UNIQUE INDEX "Proposal_proposalNumber_key" ON "Proposal"("proposalNumber");
CREATE UNIQUE INDEX "Proposal_estimateId_key" ON "Proposal"("estimateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
