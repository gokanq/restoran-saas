-- AlterTable
ALTER TABLE "CallerEvent" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "orderCode" TEXT,
ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "CallerEvent_orderId_idx" ON "CallerEvent"("orderId");

-- CreateIndex
CREATE INDEX "CallerEvent_restaurantId_convertedAt_idx" ON "CallerEvent"("restaurantId", "convertedAt");

-- AddForeignKey
ALTER TABLE "CallerEvent" ADD CONSTRAINT "CallerEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
