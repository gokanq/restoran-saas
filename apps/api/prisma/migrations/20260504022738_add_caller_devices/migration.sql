-- CreateTable
CREATE TABLE "CallerDevice" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallerDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallerDevice_keyHash_key" ON "CallerDevice"("keyHash");

-- CreateIndex
CREATE INDEX "CallerDevice_restaurantId_idx" ON "CallerDevice"("restaurantId");

-- CreateIndex
CREATE INDEX "CallerDevice_branchId_idx" ON "CallerDevice"("branchId");

-- CreateIndex
CREATE INDEX "CallerDevice_isActive_idx" ON "CallerDevice"("isActive");
