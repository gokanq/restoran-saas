-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('OPEN', 'PAYMENT_PENDING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TableSessionItemStatus" AS ENUM ('NEW', 'SENT', 'PREPARING', 'SERVED', 'VOID');

-- CreateTable
CREATE TABLE "DiningArea" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "diningAreaId" TEXT,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedByUserId" TEXT,
    "closedByUserId" TEXT,
    "cancelledReason" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "TableSessionItemStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSessionItemOption" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "optionId" TEXT,
    "groupName" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableSessionItemOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiningArea_restaurantId_idx" ON "DiningArea"("restaurantId");
CREATE INDEX "DiningArea_branchId_idx" ON "DiningArea"("branchId");
CREATE INDEX "DiningArea_isActive_idx" ON "DiningArea"("isActive");
CREATE INDEX "RestaurantTable_restaurantId_idx" ON "RestaurantTable"("restaurantId");
CREATE INDEX "RestaurantTable_branchId_idx" ON "RestaurantTable"("branchId");
CREATE INDEX "RestaurantTable_diningAreaId_idx" ON "RestaurantTable"("diningAreaId");
CREATE INDEX "RestaurantTable_isActive_idx" ON "RestaurantTable"("isActive");
CREATE INDEX "TableSession_restaurantId_idx" ON "TableSession"("restaurantId");
CREATE INDEX "TableSession_branchId_idx" ON "TableSession"("branchId");
CREATE INDEX "TableSession_tableId_idx" ON "TableSession"("tableId");
CREATE INDEX "TableSession_status_idx" ON "TableSession"("status");
CREATE INDEX "TableSessionItem_sessionId_idx" ON "TableSessionItem"("sessionId");
CREATE INDEX "TableSessionItem_menuItemId_idx" ON "TableSessionItem"("menuItemId");
CREATE INDEX "TableSessionItem_status_idx" ON "TableSessionItem"("status");
CREATE INDEX "TableSessionItemOption_itemId_idx" ON "TableSessionItemOption"("itemId");
CREATE INDEX "TableSessionItemOption_optionId_idx" ON "TableSessionItemOption"("optionId");

ALTER TABLE "DiningArea" ADD CONSTRAINT "DiningArea_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiningArea" ADD CONSTRAINT "DiningArea_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_diningAreaId_fkey" FOREIGN KEY ("diningAreaId") REFERENCES "DiningArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSessionItem" ADD CONSTRAINT "TableSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSessionItem" ADD CONSTRAINT "TableSessionItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TableSessionItemOption" ADD CONSTRAINT "TableSessionItemOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TableSessionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableSessionItemOption" ADD CONSTRAINT "TableSessionItemOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MenuItemOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
