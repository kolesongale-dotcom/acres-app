-- CreateTable
CREATE TABLE "Worker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkerSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "workerId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerId" INTEGER NOT NULL,
    "estimateId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkerAssignment_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Estimate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateNumber" TEXT NOT NULL,
    "projectName" TEXT NOT NULL DEFAULT '',
    "customerId" INTEGER,
    "street" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'PA',
    "zip" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "completedAt" DATETIME,
    "globalWallRate" REAL NOT NULL DEFAULT 0.65,
    "globalCeilRate" REAL NOT NULL DEFAULT 0.45,
    "globalTrimRate" REAL NOT NULL DEFAULT 0.30,
    "globalMarkup" REAL NOT NULL DEFAULT 30,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" REAL NOT NULL DEFAULT 0,
    "ratesSnapshot" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workerNotes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Estimate" ("city", "completedAt", "createdAt", "customerId", "discountType", "discountValue", "durationDays", "endDate", "estimateNumber", "globalCeilRate", "globalMarkup", "globalTrimRate", "globalWallRate", "id", "notes", "projectName", "ratesSnapshot", "startDate", "state", "status", "street", "taxRate", "updatedAt", "zip") SELECT "city", "completedAt", "createdAt", "customerId", "discountType", "discountValue", "durationDays", "endDate", "estimateNumber", "globalCeilRate", "globalMarkup", "globalTrimRate", "globalWallRate", "id", "notes", "projectName", "ratesSnapshot", "startDate", "state", "status", "street", "taxRate", "updatedAt", "zip" FROM "Estimate";
DROP TABLE "Estimate";
ALTER TABLE "new_Estimate" RENAME TO "Estimate";
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_username_key" ON "Worker"("username");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerSession_token_key" ON "WorkerSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAssignment_workerId_estimateId_key" ON "WorkerAssignment"("workerId", "estimateId");
