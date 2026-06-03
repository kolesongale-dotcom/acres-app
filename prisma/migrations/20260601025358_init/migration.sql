-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Acres Painting Co.',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "globalTaxRate" REAL NOT NULL DEFAULT 0,
    "globalMarkupDefault" REAL NOT NULL DEFAULT 30,
    "standardTerms" TEXT NOT NULL DEFAULT '',
    "standardExclusions" TEXT NOT NULL DEFAULT '',
    "midDepositPercent" REAL NOT NULL DEFAULT 15,
    "midDepositDiscount" REAL NOT NULL DEFAULT 3,
    "maxDepositPercent" REAL NOT NULL DEFAULT 30,
    "maxDepositDiscount" REAL NOT NULL DEFAULT 6,
    "proposalEmailTemplate" TEXT NOT NULL DEFAULT 'Thank you for the opportunity to provide this estimate. Please find your proposal attached. We look forward to working with you.

Best,
Acres Painting Co.'
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'PA',
    "zip" TEXT NOT NULL DEFAULT '',
    "leadSource" TEXT NOT NULL DEFAULT 'Unknown',
    "status" TEXT NOT NULL DEFAULT 'lead',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FollowUpReminder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "estimateId" INTEGER,
    "dueDate" DATETIME NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUpReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpReminder_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Estimate" (
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
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstimateLineItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Labor',
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "markup" REAL NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EstimateLineItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
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
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Room_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomDeduction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Window',
    "width" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "RoomDeduction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccentWall" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Accent Wall',
    "length" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    "product" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "AccentWall_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CabinetSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Cabinet Set',
    "doorCount" INTEGER NOT NULL DEFAULT 0,
    "drawerCount" INTEGER NOT NULL DEFAULT 0,
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "primerProduct" TEXT NOT NULL DEFAULT '',
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "paintGallons" REAL NOT NULL DEFAULT 0,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CabinetSet_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeckArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Deck',
    "floorLength" REAL NOT NULL DEFAULT 0,
    "floorWidth" REAL NOT NULL DEFAULT 0,
    "railingLinFt" REAL NOT NULL DEFAULT 0,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "latticeSqFt" REAL NOT NULL DEFAULT 0,
    "powerWashCost" REAL NOT NULL DEFAULT 0,
    "woodReplCost" REAL NOT NULL DEFAULT 0,
    "stainProduct" TEXT NOT NULL DEFAULT '',
    "laborRate" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DeckArea_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExteriorHouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Exterior',
    "sidingLength" REAL NOT NULL DEFAULT 0,
    "sidingWidth" REAL NOT NULL DEFAULT 0,
    "sidingHeight" REAL NOT NULL DEFAULT 0,
    "sidingMaterial" TEXT NOT NULL DEFAULT 'Vinyl',
    "powerWashRate" REAL NOT NULL DEFAULT 0,
    "laborRate" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorHouse_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExteriorDeduction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exteriorHouseId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Window',
    "width" REAL NOT NULL DEFAULT 0,
    "height" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorDeduction_exteriorHouseId_fkey" FOREIGN KEY ("exteriorHouseId") REFERENCES "ExteriorHouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExteriorReplacement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exteriorHouseId" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cost" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorReplacement_exteriorHouseId_fkey" FOREIGN KEY ("exteriorHouseId") REFERENCES "ExteriorHouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExteriorDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Door',
    "count" INTEGER NOT NULL DEFAULT 1,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExteriorShutter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Shutters',
    "count" INTEGER NOT NULL DEFAULT 1,
    "ratePerShutter" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorShutter_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExteriorGarageDoor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Garage Door',
    "count" INTEGER NOT NULL DEFAULT 1,
    "ratePerDoor" REAL NOT NULL DEFAULT 0,
    "paintProduct" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExteriorGarageDoor_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OverheadItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "markup" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OverheadItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Proposal" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcedureTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "BudgetEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "estimateId" INTEGER NOT NULL,
    "estimatedRevenue" REAL NOT NULL DEFAULT 0,
    "estimatedLaborCost" REAL NOT NULL DEFAULT 0,
    "estimatedMaterialCost" REAL NOT NULL DEFAULT 0,
    "estimatedOverhead" REAL NOT NULL DEFAULT 0,
    "actualRevenue" REAL NOT NULL DEFAULT 0,
    "actualLaborCost" REAL NOT NULL DEFAULT 0,
    "actualMaterialCost" REAL NOT NULL DEFAULT 0,
    "actualOverhead" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNumber_key" ON "Customer"("customerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalNumber_key" ON "Proposal"("proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_estimateId_key" ON "Proposal"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetEntry_estimateId_key" ON "BudgetEntry"("estimateId");
