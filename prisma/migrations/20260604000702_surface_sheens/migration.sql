-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CabinetSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Cabinet Set',
    "sheen" TEXT NOT NULL DEFAULT 'Unsure',
    "doorCount" INTEGER NOT NULL DEFAULT 0,
    "drawerCount" INTEGER NOT NULL DEFAULT 0,
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "doorRate" REAL NOT NULL DEFAULT 0,
    "drawerRate" REAL NOT NULL DEFAULT 0,
    "frameRate" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerProduct" TEXT NOT NULL DEFAULT '',
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintGallons" REAL NOT NULL DEFAULT 0,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "paintId" INTEGER,
    "primerId" INTEGER,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CabinetSet_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CabinetSet" ("coats", "doorCount", "doorRate", "drawerCount", "drawerRate", "estimateId", "frameCount", "frameRate", "id", "laborRate", "materials", "name", "paintGallons", "paintId", "paintProduct", "primerCoats", "primerId", "primerProduct", "sortOrder") SELECT "coats", "doorCount", "doorRate", "drawerCount", "drawerRate", "estimateId", "frameCount", "frameRate", "id", "laborRate", "materials", "name", "paintGallons", "paintId", "paintProduct", "primerCoats", "primerId", "primerProduct", "sortOrder" FROM "CabinetSet";
DROP TABLE "CabinetSet";
ALTER TABLE "new_CabinetSet" RENAME TO "CabinetSet";
CREATE TABLE "new_CustomArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Custom Area',
    "sheen" TEXT NOT NULL DEFAULT 'Unsure',
    "measureType" TEXT NOT NULL DEFAULT 'area',
    "amount" REAL NOT NULL DEFAULT 0,
    "rate" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "primerPaintId" INTEGER,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomArea_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CustomArea" ("amount", "coats", "estimateId", "id", "label", "materials", "measureType", "paintId", "paintProduct", "primerCoats", "primerPaintId", "primerSqftAdjust", "rate", "sortOrder") SELECT "amount", "coats", "estimateId", "id", "label", "materials", "measureType", "paintId", "paintProduct", "primerCoats", "primerPaintId", "primerSqftAdjust", "rate", "sortOrder" FROM "CustomArea";
DROP TABLE "CustomArea";
ALTER TABLE "new_CustomArea" RENAME TO "CustomArea";
CREATE TABLE "new_DeckArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Deck',
    "floorSheen" TEXT NOT NULL DEFAULT 'Unsure',
    "railSheen" TEXT NOT NULL DEFAULT 'Unsure',
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
    "primerPaintId" INTEGER,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "laborRate" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DeckArea_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DeckArea" ("coats", "estimateId", "floorLength", "floorRate", "floorSqFt", "floorStainId", "floorWidth", "id", "includeLattice", "includeRailing", "laborRate", "latticeRate", "latticeSqFt", "materials", "name", "powerWashCost", "primerCoats", "primerPaintId", "primerSqftAdjust", "railStainId", "railingLinFt", "railingRate", "sortOrder", "stainId", "stainProduct", "stepCount", "stepRate", "woodReplCost") SELECT "coats", "estimateId", "floorLength", "floorRate", "floorSqFt", "floorStainId", "floorWidth", "id", "includeLattice", "includeRailing", "laborRate", "latticeRate", "latticeSqFt", "materials", "name", "powerWashCost", "primerCoats", "primerPaintId", "primerSqftAdjust", "railStainId", "railingLinFt", "railingRate", "sortOrder", "stainId", "stainProduct", "stepCount", "stepRate", "woodReplCost" FROM "DeckArea";
DROP TABLE "DeckArea";
ALTER TABLE "new_DeckArea" RENAME TO "DeckArea";
CREATE TABLE "new_ExteriorDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Door',
    "sheen" TEXT NOT NULL DEFAULT 'Unsure',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 3,
    "height" REAL NOT NULL DEFAULT 7,
    "paintedSides" INTEGER NOT NULL DEFAULT 1,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "primerPaintId" INTEGER,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorDoor" ("coats", "count", "estimateId", "height", "id", "materials", "name", "paintId", "paintProduct", "paintedSides", "primerCoats", "primerPaintId", "primerSqftAdjust", "ratePerDoor", "ratePerSqFt", "sortOrder", "width") SELECT "coats", "count", "estimateId", "height", "id", "materials", "name", "paintId", "paintProduct", "paintedSides", "primerCoats", "primerPaintId", "primerSqftAdjust", "ratePerDoor", "ratePerSqFt", "sortOrder", "width" FROM "ExteriorDoor";
DROP TABLE "ExteriorDoor";
ALTER TABLE "new_ExteriorDoor" RENAME TO "ExteriorDoor";
CREATE TABLE "new_ExteriorGarageDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Garage Door',
    "sheen" TEXT NOT NULL DEFAULT 'Unsure',
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 9,
    "height" REAL NOT NULL DEFAULT 7,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "ratePerSqFt" REAL NOT NULL DEFAULT 0,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintId" INTEGER,
    "primerPaintId" INTEGER,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorGarageDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorGarageDoor" ("coats", "count", "estimateId", "height", "id", "materials", "name", "paintId", "paintProduct", "primerCoats", "primerPaintId", "primerSqftAdjust", "ratePerDoor", "ratePerSqFt", "sortOrder", "width") SELECT "coats", "count", "estimateId", "height", "id", "materials", "name", "paintId", "paintProduct", "primerCoats", "primerPaintId", "primerSqftAdjust", "ratePerDoor", "ratePerSqFt", "sortOrder", "width" FROM "ExteriorGarageDoor";
DROP TABLE "ExteriorGarageDoor";
ALTER TABLE "new_ExteriorGarageDoor" RENAME TO "ExteriorGarageDoor";
CREATE TABLE "new_ExteriorHouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Exterior',
    "sheen" TEXT NOT NULL DEFAULT 'Unsure',
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
    "primerPaintId" INTEGER,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorHouse_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorHouse" ("coats", "estimateId", "id", "laborRate", "materials", "name", "paintId", "paintProduct", "powerWashRate", "primerCoats", "primerPaintId", "primerSqftAdjust", "sidingHeight", "sidingLength", "sidingMaterial", "sidingSqFt", "sidingSqftAdjust", "sidingWidth", "sortOrder") SELECT "coats", "estimateId", "id", "laborRate", "materials", "name", "paintId", "paintProduct", "powerWashRate", "primerCoats", "primerPaintId", "primerSqftAdjust", "sidingHeight", "sidingLength", "sidingMaterial", "sidingSqFt", "sidingSqftAdjust", "sidingWidth", "sortOrder" FROM "ExteriorHouse";
DROP TABLE "ExteriorHouse";
ALTER TABLE "new_ExteriorHouse" RENAME TO "ExteriorHouse";
CREATE TABLE "new_ExteriorShutter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'House Shutters',
    "sheen" TEXT NOT NULL DEFAULT 'Unsure',
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
    "primerPaintId" INTEGER,
    "primerCoats" INTEGER NOT NULL DEFAULT 1,
    "primerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorShutter_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExteriorShutter" ("coats", "count", "customQty", "customRate", "estimateId", "height", "id", "materials", "name", "paintId", "paintProduct", "primerCoats", "primerPaintId", "primerSqftAdjust", "ratePerShutter", "ratePerSqFt", "sortOrder", "story1", "story2", "story3", "width") SELECT "coats", "count", "customQty", "customRate", "estimateId", "height", "id", "materials", "name", "paintId", "paintProduct", "primerCoats", "primerPaintId", "primerSqftAdjust", "ratePerShutter", "ratePerSqFt", "sortOrder", "story1", "story2", "story3", "width" FROM "ExteriorShutter";
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
    "wallSheen" TEXT NOT NULL DEFAULT 'Unsure',
    "ceilingSheen" TEXT NOT NULL DEFAULT 'Unsure',
    "trimSheen" TEXT NOT NULL DEFAULT 'Unsure',
    "wallPaintId" INTEGER,
    "ceilingPaintId" INTEGER,
    "trimPaintId" INTEGER,
    "trimLinearFt" REAL,
    "wallSqftAdjust" REAL NOT NULL DEFAULT 0,
    "ceilingSqftAdjust" REAL NOT NULL DEFAULT 0,
    "trimLfAdjust" REAL NOT NULL DEFAULT 0,
    "wallPrimerPaintId" INTEGER,
    "wallPrimerCoats" INTEGER NOT NULL DEFAULT 1,
    "wallPrimerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "ceilingPrimerPaintId" INTEGER,
    "ceilingPrimerCoats" INTEGER NOT NULL DEFAULT 1,
    "ceilingPrimerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "trimPrimerPaintId" INTEGER,
    "trimPrimerCoats" INTEGER NOT NULL DEFAULT 1,
    "trimPrimerSqftAdjust" REAL NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Room_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("ceilingCoats", "ceilingPaintId", "ceilingPrimerCoats", "ceilingPrimerPaintId", "ceilingPrimerSqftAdjust", "ceilingProduct", "ceilingRate", "ceilingSqftAdjust", "estimateId", "height", "id", "length", "materials", "name", "paintCeiling", "paintTrim", "paintWalls", "sortOrder", "trimCoats", "trimLfAdjust", "trimLinearFt", "trimPaintId", "trimPrimerCoats", "trimPrimerPaintId", "trimPrimerSqftAdjust", "trimProduct", "trimRate", "wallCoats", "wallPaintId", "wallPrimerCoats", "wallPrimerPaintId", "wallPrimerSqftAdjust", "wallProduct", "wallRate", "wallSqftAdjust", "width") SELECT "ceilingCoats", "ceilingPaintId", "ceilingPrimerCoats", "ceilingPrimerPaintId", "ceilingPrimerSqftAdjust", "ceilingProduct", "ceilingRate", "ceilingSqftAdjust", "estimateId", "height", "id", "length", "materials", "name", "paintCeiling", "paintTrim", "paintWalls", "sortOrder", "trimCoats", "trimLfAdjust", "trimLinearFt", "trimPaintId", "trimPrimerCoats", "trimPrimerPaintId", "trimPrimerSqftAdjust", "trimProduct", "trimRate", "wallCoats", "wallPaintId", "wallPrimerCoats", "wallPrimerPaintId", "wallPrimerSqftAdjust", "wallProduct", "wallRate", "wallSqftAdjust", "width" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
