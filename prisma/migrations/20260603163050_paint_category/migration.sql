-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PriceBookItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL DEFAULT 'material',
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'each',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "markup" REAL NOT NULL DEFAULT 30,
    "coverage" REAL NOT NULL DEFAULT 400,
    "category" TEXT NOT NULL DEFAULT 'Interior Wall/Ceiling',
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PriceBookItem" ("brand", "coverage", "createdAt", "id", "markup", "name", "notes", "sortOrder", "type", "unit", "unitCost", "updatedAt") SELECT "brand", "coverage", "createdAt", "id", "markup", "name", "notes", "sortOrder", "type", "unit", "unitCost", "updatedAt" FROM "PriceBookItem";
DROP TABLE "PriceBookItem";
ALTER TABLE "new_PriceBookItem" RENAME TO "PriceBookItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
