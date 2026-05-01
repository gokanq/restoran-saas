-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('TABLE', 'DELIVERY', 'TAKEAWAY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerAddress" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "type" "OrderType" NOT NULL DEFAULT 'DELIVERY';
