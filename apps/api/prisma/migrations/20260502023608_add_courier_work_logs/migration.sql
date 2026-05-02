-- CreateTable
CREATE TABLE "CourierWorkLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourierWorkLog_restaurantId_workDate_idx" ON "CourierWorkLog"("restaurantId", "workDate");

-- CreateIndex
CREATE INDEX "CourierWorkLog_courierId_idx" ON "CourierWorkLog"("courierId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierWorkLog_restaurantId_courierId_workDate_key" ON "CourierWorkLog"("restaurantId", "courierId", "workDate");

-- AddForeignKey
ALTER TABLE "CourierWorkLog" ADD CONSTRAINT "CourierWorkLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierWorkLog" ADD CONSTRAINT "CourierWorkLog_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
