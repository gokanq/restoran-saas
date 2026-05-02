-- AlterTable
ALTER TABLE "DiningArea" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RestaurantTable" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DiningArea_deletedAt_idx" ON "DiningArea"("deletedAt");

-- CreateIndex
CREATE INDEX "RestaurantTable_deletedAt_idx" ON "RestaurantTable"("deletedAt");
