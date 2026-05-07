-- DropIndex
DROP INDEX "PlatformIntegration_restaurantId_platform_key";

-- AlterTable
ALTER TABLE "PlatformIntegration" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';
