-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierId" TEXT;

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "perPackageFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "hourlyFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Courier_restaurantId_idx" ON "Courier"("restaurantId");

-- CreateIndex
CREATE INDEX "Courier_branchId_idx" ON "Courier"("branchId");

-- CreateIndex
CREATE INDEX "Courier_isActive_idx" ON "Courier"("isActive");

-- CreateIndex
CREATE INDEX "Order_courierId_idx" ON "Order"("courierId");

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
