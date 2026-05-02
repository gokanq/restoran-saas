-- Table service V2: reservation fields for restaurant tables

ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "isReserved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "reservedName" TEXT;
ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "reservedPhone" TEXT;
ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "reservedNote" TEXT;
ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RestaurantTable_isReserved_idx" ON "RestaurantTable"("isReserved");
