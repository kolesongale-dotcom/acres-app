-- CreateTable
CREATE TABLE "ColorSelection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "slotKey" TEXT NOT NULL,
    "colorName" TEXT NOT NULL DEFAULT '',
    "colorCode" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ColorSelection_estimateId_slotKey_key" ON "ColorSelection"("estimateId", "slotKey");
