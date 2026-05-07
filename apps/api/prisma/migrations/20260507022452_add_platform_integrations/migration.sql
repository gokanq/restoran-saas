-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('TRENDYOL', 'GETIR', 'YEMEKSEPETI');

-- CreateTable
CREATE TABLE "PlatformIntegration" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "platform" "PlatformType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supplierId" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "baseUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformOrder" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "platformStatus" TEXT,
    "orderId" TEXT,
    "rawPayload" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformIntegration_restaurantId_idx" ON "PlatformIntegration"("restaurantId");

-- CreateIndex
CREATE INDEX "PlatformIntegration_platform_idx" ON "PlatformIntegration"("platform");

-- CreateIndex
CREATE INDEX "PlatformIntegration_isActive_idx" ON "PlatformIntegration"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformIntegration_restaurantId_platform_key" ON "PlatformIntegration"("restaurantId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOrder_orderId_key" ON "PlatformOrder"("orderId");

-- CreateIndex
CREATE INDEX "PlatformOrder_restaurantId_idx" ON "PlatformOrder"("restaurantId");

-- CreateIndex
CREATE INDEX "PlatformOrder_platform_restaurantId_idx" ON "PlatformOrder"("platform", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOrder_platform_platformOrderId_key" ON "PlatformOrder"("platform", "platformOrderId");
