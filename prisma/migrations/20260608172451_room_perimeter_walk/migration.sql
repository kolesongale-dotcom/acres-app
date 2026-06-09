-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Room',
    "length" REAL NOT NULL DEFAULT 0,
    "width" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    "measureMode" TEXT NOT NULL DEFAULT 'simple',
    "wallsJson" TEXT NOT NULL DEFAULT '[]',
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
INSERT INTO "new_Room" ("ceilingCoats", "ceilingPaintId", "ceilingPrimerCoats", "ceilingPrimerPaintId", "ceilingPrimerSqftAdjust", "ceilingProduct", "ceilingRate", "ceilingSheen", "ceilingSqftAdjust", "estimateId", "height", "id", "length", "materials", "name", "paintCeiling", "paintTrim", "paintWalls", "sortOrder", "trimCoats", "trimLfAdjust", "trimLinearFt", "trimPaintId", "trimPrimerCoats", "trimPrimerPaintId", "trimPrimerSqftAdjust", "trimProduct", "trimRate", "trimSheen", "wallCoats", "wallPaintId", "wallPrimerCoats", "wallPrimerPaintId", "wallPrimerSqftAdjust", "wallProduct", "wallRate", "wallSheen", "wallSqftAdjust", "width") SELECT "ceilingCoats", "ceilingPaintId", "ceilingPrimerCoats", "ceilingPrimerPaintId", "ceilingPrimerSqftAdjust", "ceilingProduct", "ceilingRate", "ceilingSheen", "ceilingSqftAdjust", "estimateId", "height", "id", "length", "materials", "name", "paintCeiling", "paintTrim", "paintWalls", "sortOrder", "trimCoats", "trimLfAdjust", "trimLinearFt", "trimPaintId", "trimPrimerCoats", "trimPrimerPaintId", "trimPrimerSqftAdjust", "trimProduct", "trimRate", "trimSheen", "wallCoats", "wallPaintId", "wallPrimerCoats", "wallPrimerPaintId", "wallPrimerSqftAdjust", "wallProduct", "wallRate", "wallSheen", "wallSqftAdjust", "width" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
