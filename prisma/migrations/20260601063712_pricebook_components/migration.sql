-- AlterTable
ALTER TABLE "Room" ADD COLUMN "ceilingPaintId" INTEGER;
ALTER TABLE "Room" ADD COLUMN "trimLinearFt" REAL;
ALTER TABLE "Room" ADD COLUMN "trimPaintId" INTEGER;
ALTER TABLE "Room" ADD COLUMN "wallPaintId" INTEGER;

-- CreateTable
CREATE TABLE "CustomArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Custom Area',
    "measureType" TEXT NOT NULL DEFAULT 'area',
    "amount" REAL NOT NULL DEFAULT 0,
    "rate" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomArea_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceBookItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL DEFAULT 'material',
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'each',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "markup" REAL NOT NULL DEFAULT 30,
    "coverage" REAL NOT NULL DEFAULT 400,
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccentWall" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Accent Wall',
    "length" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "product" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    CONSTRAINT "AccentWall_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AccentWall" ("height", "id", "label", "length", "product", "roomId") SELECT "height", "id", "label", "length", "product", "roomId" FROM "AccentWall";
DROP TABLE "AccentWall";
ALTER TABLE "new_AccentWall" RENAME TO "AccentWall";
CREATE TABLE "new_CabinetSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Cabinet Set',
    "doorCount" INTEGER NOT NULL DEFAULT 0,
    "drawerCount" INTEGER NOT NULL DEFAULT 0,
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "doorRate" REAL NOT NULL DEFAULT 0,
    "drawerRate" REAL NOT NULL DEFAULT 0,
    "frameRate" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "primerProduct" TEXT NOT NULL DEFAULT '',
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintGallons" REAL NOT NULL DEFAULT 0,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "paintId" INTEGER,
    "primerId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CabinetSet_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CabinetSet" ("doorCount", "drawerCount", "estimateId", "frameCount", "id", "laborRate", "name", "paintGallons", "paintProduct", "primerProduct", "sortOrder") SELECT "doorCount", "drawerCount", "estimateId", "frameCount", "id", "laborRate", "name", "paintGallons", "paintProduct", "primerProduct", "sortOrder" FROM "CabinetSet";
DROP TABLE "CabinetSet";
ALTER TABLE "new_CabinetSet" RENAME TO "CabinetSet";
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
    "powerWashCost" REAL NOT NULL DEFAULT 0,
    "woodReplCost" REAL NOT NULL DEFAULT 0,
    "stainProduct" TEXT NOT NULL DEFAULT '',
    "stainId" INTEGER,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DeckArea_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DeckArea" ("estimateId", "floorLength", "floorWidth", "id", "laborRate", "latticeSqFt", "name", "powerWashCost", "railingLinFt", "sortOrder", "stainProduct", "stepCount", "woodReplCost") SELECT "estimateId", "floorLength", "floorWidth", "id", "laborRate", "latticeSqFt", "name", "powerWashCost", "railingLinFt", "sortOrder", "stainProduct", "stepCount", "woodReplCost" FROM "DeckArea";
DROP TABLE "DeckArea";
ALTER TABLE "new_DeckArea" RENAME TO "DeckArea";
CREATE TABLE "new_EstimateLineItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Labor',
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "markup" REAL NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT NOT NULL DEFAULT '',
    "priceBookItemId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EstimateLineItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EstimateLineItem" ("category", "description", "estimateId", "id", "markup", "quantity", "sortOrder", "taxable", "unitCost") SELECT "category", "description", "estimateId", "id", "markup", "quantity", "sortOrder", "taxable", "unitCost" FROM "EstimateLineItem";
DROP TABLE "EstimateLineItem";
ALTER TABLE "new_EstimateLineItem" RENAME TO "EstimateLineItem";
CREATE TABLE "new_ExteriorDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Door',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 3,
    "height" REAL NOT NULL DEFAULT 7,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorDoor" ("count", "estimateId", "id", "name", "paintProduct", "ratePerDoor", "sortOrder") SELECT "count", "estimateId", "id", "name", "paintProduct", "ratePerDoor", "sortOrder" FROM "ExteriorDoor";
DROP TABLE "ExteriorDoor";
ALTER TABLE "new_ExteriorDoor" RENAME TO "ExteriorDoor";
CREATE TABLE "new_ExteriorGarageDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Garage Door',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 9,
    "height" REAL NOT NULL DEFAULT 7,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorGarageDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorGarageDoor" ("count", "estimateId", "id", "name", "paintProduct", "ratePerDoor", "sortOrder") SELECT "count", "estimateId", "id", "name", "paintProduct", "ratePerDoor", "sortOrder" FROM "ExteriorGarageDoor";
DROP TABLE "ExteriorGarageDoor";
ALTER TABLE "new_ExteriorGarageDoor" RENAME TO "ExteriorGarageDoor";
CREATE TABLE "new_ExteriorHouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Exterior',
    "sidingLength" REAL NOT NULL DEFAULT 0,
    "sidingWidth" REAL NOT NULL DEFAULT 0,
    "sidingHeight" REAL NOT NULL DEFAULT 0,
    "sidingMaterial" TEXT NOT NULL DEFAULT 'Vinyl',
    "sidingSqFt" REAL,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "powerWashRate" REAL NOT NULL DEFAULT 0,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorHouse_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorHouse" ("estimateId", "id", "laborRate", "name", "paintProduct", "powerWashRate", "sidingHeight", "sidingLength", "sidingMaterial", "sidingWidth", "sortOrder") SELECT "estimateId", "id", "laborRate", "name", "paintProduct", "powerWashRate", "sidingHeight", "sidingLength", "sidingMaterial", "sidingWidth", "sortOrder" FROM "ExteriorHouse";
DROP TABLE "ExteriorHouse";
ALTER TABLE "new_ExteriorHouse" RENAME TO "ExteriorHouse";
CREATE TABLE "new_ExteriorShutter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Shutters',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 1.25,
    "height" REAL NOT NULL DEFAULT 5,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerShutter" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorShutter_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorShutter" ("count", "estimateId", "id", "name", "paintProduct", "ratePerShutter", "sortOrder") SELECT "count", "estimateId", "id", "name", "paintProduct", "ratePerShutter", "sortOrder" FROM "ExteriorShutter";
DROP TABLE "ExteriorShutter";
ALTER TABLE "new_ExteriorShutter" RENAME TO "ExteriorShutter";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
