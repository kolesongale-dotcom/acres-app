-- CreateTable
CREATE TABLE "JobRateSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "wallRate" REAL NOT NULL DEFAULT 0.65,
    "ceilingRate" REAL NOT NULL DEFAULT 0.45,
    "trimRate" REAL NOT NULL DEFAULT 1.5,
    "cabinetDoorRate" REAL NOT NULL DEFAULT 45,
    "cabinetDrawerRate" REAL NOT NULL DEFAULT 25,
    "cabinetFrameRate" REAL NOT NULL DEFAULT 60,
    "deckFloorRate" REAL NOT NULL DEFAULT 2.5,
    "deckRailingRate" REAL NOT NULL DEFAULT 3,
    "deckStepRate" REAL NOT NULL DEFAULT 12,
    "deckLatticeRate" REAL NOT NULL DEFAULT 2,
    "sidingRate" REAL NOT NULL DEFAULT 1.5,
    "powerWashRate" REAL NOT NULL DEFAULT 0.15,
    "doorRate" REAL NOT NULL DEFAULT 2.5,
    "shutterStory1Rate" REAL NOT NULL DEFAULT 35,
    "shutterStory2Rate" REAL NOT NULL DEFAULT 45,
    "shutterStory3Rate" REAL NOT NULL DEFAULT 55,
    "shutterSqFtEach" REAL NOT NULL DEFAULT 6,
    "garageRate" REAL NOT NULL DEFAULT 2,
    "laborMarkup" REAL NOT NULL DEFAULT 30,
    "defaultWallPaintId" INTEGER,
    "defaultCeilingPaintId" INTEGER,
    "defaultTrimPaintId" INTEGER,
    "defaultDeckFloorStainId" INTEGER,
    "defaultDeckRailStainId" INTEGER,
    "defaultSidingPaintId" INTEGER,
    "defaultDoorPaintId" INTEGER,
    "defaultShutterPaintId" INTEGER,
    "defaultGaragePaintId" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeckArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Deck',
    "floorLength" REAL NOT NULL DEFAULT 0,
    "floorWidth" REAL NOT NULL DEFAULT 0,
    "floorSqFt" REAL,
    "railingLinFt" REAL NOT NULL DEFAULT 0,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "latticeSqFt" REAL NOT NULL DEFAULT 0,
    "floorRate" REAL NOT NULL DEFAULT 0,
    "railingRate" REAL NOT NULL DEFAULT 0,
    "stepRate" REAL NOT NULL DEFAULT 0,
    "latticeRate" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "includeRailing" BOOLEAN NOT NULL DEFAULT true,
    "includeLattice" BOOLEAN NOT NULL DEFAULT true,
    "powerWashCost" REAL NOT NULL DEFAULT 0,
    "woodReplCost" REAL NOT NULL DEFAULT 0,
    "stainProduct" TEXT NOT NULL DEFAULT '',
    "stainId" INTEGER,
    "floorStainId" INTEGER,
    "railStainId" INTEGER,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DeckArea_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DeckArea" ("coats", "estimateId", "floorLength", "floorRate", "floorSqFt", "floorWidth", "id", "laborRate", "latticeRate", "latticeSqFt", "name", "powerWashCost", "railingLinFt", "railingRate", "sortOrder", "stainId", "stainProduct", "stepCount", "stepRate", "woodReplCost") SELECT "coats", "estimateId", "floorLength", "floorRate", "floorSqFt", "floorWidth", "id", "laborRate", "latticeRate", "latticeSqFt", "name", "powerWashCost", "railingLinFt", "railingRate", "sortOrder", "stainId", "stainProduct", "stepCount", "stepRate", "woodReplCost" FROM "DeckArea";
DROP TABLE "DeckArea";
ALTER TABLE "new_DeckArea" RENAME TO "DeckArea";
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
    CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Estimate" ("city", "createdAt", "customerId", "discountType", "discountValue", "durationDays", "endDate", "estimateNumber", "globalCeilRate", "globalMarkup", "globalTrimRate", "globalWallRate", "id", "notes", "projectName", "startDate", "state", "status", "street", "taxRate", "updatedAt", "zip") SELECT "city", "createdAt", "customerId", "discountType", "discountValue", "durationDays", "endDate", "estimateNumber", "globalCeilRate", "globalMarkup", "globalTrimRate", "globalWallRate", "id", "notes", "projectName", "startDate", "state", "status", "street", "taxRate", "updatedAt", "zip" FROM "Estimate";
DROP TABLE "Estimate";
ALTER TABLE "new_Estimate" RENAME TO "Estimate";
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");
CREATE TABLE "new_ExteriorDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Door',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 3,
    "height" REAL NOT NULL DEFAULT 7,
    "paintedSides" INTEGER NOT NULL DEFAULT 1,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorDoor" ("coats", "count", "estimateId", "height", "id", "name", "paintId", "paintProduct", "ratePerDoor", "ratePerSqFt", "sortOrder", "width") SELECT "coats", "count", "estimateId", "height", "id", "name", "paintId", "paintProduct", "ratePerDoor", "ratePerSqFt", "sortOrder", "width" FROM "ExteriorDoor";
DROP TABLE "ExteriorDoor";
ALTER TABLE "new_ExteriorDoor" RENAME TO "ExteriorDoor";
CREATE TABLE "new_ExteriorHouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Exterior',
    "sidingLength" REAL NOT NULL DEFAULT 0,
    "sidingWidth" REAL NOT NULL DEFAULT 0,
    "sidingHeight" REAL NOT NULL DEFAULT 0,
    "sidingMaterial" TEXT NOT NULL DEFAULT 'Vinyl',
    "sidingSqFt" REAL,
    "sidingSqftAdjust" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "powerWashRate" REAL NOT NULL DEFAULT 0,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorHouse_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorHouse" ("coats", "estimateId", "id", "laborRate", "name", "paintId", "paintProduct", "powerWashRate", "sidingHeight", "sidingLength", "sidingMaterial", "sidingSqFt", "sidingWidth", "sortOrder") SELECT "coats", "estimateId", "id", "laborRate", "name", "paintId", "paintProduct", "powerWashRate", "sidingHeight", "sidingLength", "sidingMaterial", "sidingSqFt", "sidingWidth", "sortOrder" FROM "ExteriorHouse";
DROP TABLE "ExteriorHouse";
ALTER TABLE "new_ExteriorHouse" RENAME TO "ExteriorHouse";
CREATE TABLE "new_ExteriorShutter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'House Shutters',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 1.25,
    "height" REAL NOT NULL DEFAULT 5,
    "story1" INTEGER NOT NULL DEFAULT 0,
    "story2" INTEGER NOT NULL DEFAULT 0,
    "story3" INTEGER NOT NULL DEFAULT 0,
    "customQty" INTEGER NOT NULL DEFAULT 0,
    "customRate" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerShutter" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorShutter_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorShutter" ("coats", "count", "estimateId", "height", "id", "name", "paintId", "paintProduct", "ratePerShutter", "ratePerSqFt", "sortOrder", "width") SELECT "coats", "count", "estimateId", "height", "id", "name", "paintId", "paintProduct", "ratePerShutter", "ratePerSqFt", "sortOrder", "width" FROM "ExteriorShutter";
DROP TABLE "ExteriorShutter";
ALTER TABLE "new_ExteriorShutter" RENAME TO "ExteriorShutter";
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Room',
    "length" REAL NOT NULL DEFAULT 0,
    "width" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    "paintWalls" BOOLEAN NOT NULL DEFAULT true,
    "paintCeiling" BOOLEAN NOT NULL DEFAULT false,
    "paintTrim" BOOLEAN NOT NULL DEFAULT false,
    "wallCoats" INTEGER NOT NULL DEFAULT 2,
    "ceilingCoats" INTEGER NOT NULL DEFAULT 1,
    "trimCoats" INTEGER NOT NULL DEFAULT 2,
    "wallRate" REAL,
    "ceilingRate" REAL,
    "trimRate" REAL,
    "wallProduct" TEXT NOT NULL DEFAULT '',
    "ceilingProduct" TEXT NOT NULL DEFAULT '',
    "trimProduct" TEXT NOT NULL DEFAULT '',
    "wallPaintId" INTEGER,
    "ceilingPaintId" INTEGER,
    "trimPaintId" INTEGER,
    "trimLinearFt" REAL,
    "wallSqftAdjust" REAL NOT NULL DEFAULT 0,
    "ceilingSqftAdjust" REAL NOT NULL DEFAULT 0,
    "trimLfAdjust" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Room_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("ceilingCoats", "ceilingPaintId", "ceilingProduct", "ceilingRate", "estimateId", "height", "id", "length", "name", "paintCeiling", "paintTrim", "paintWalls", "sortOrder", "trimCoats", "trimLinearFt", "trimPaintId", "trimProduct", "trimRate", "wallCoats", "wallPaintId", "wallProduct", "wallRate", "width") SELECT "ceilingCoats", "ceilingPaintId", "ceilingProduct", "ceilingRate", "estimateId", "height", "id", "length", "name", "paintCeiling", "paintTrim", "paintWalls", "sortOrder", "trimCoats", "trimLinearFt", "trimPaintId", "trimProduct", "trimRate", "wallCoats", "wallPaintId", "wallProduct", "wallRate", "width" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE TABLE "new_RoomDeduction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Window',
    "kind" TEXT NOT NULL DEFAULT 'window',
    "width" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    "includeTrim" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RoomDeduction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoomDeduction" ("height", "id", "label", "roomId", "width") SELECT "height", "id", "label", "roomId", "width" FROM "RoomDeduction";
DROP TABLE "RoomDeduction";
ALTER TABLE "new_RoomDeduction" RENAME TO "RoomDeduction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
