-- CreateTable
CREATE TABLE "CallerEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallerEvent_restaurantId_status_receivedAt_idx" ON "CallerEvent"("restaurantId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "CallerEvent_restaurantId_phoneNormalized_idx" ON "CallerEvent"("restaurantId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "CallerEvent_branchId_idx" ON "CallerEvent"("branchId");

-- CreateIndex
CREATE INDEX "CallerEvent_customerId_idx" ON "CallerEvent"("customerId");
