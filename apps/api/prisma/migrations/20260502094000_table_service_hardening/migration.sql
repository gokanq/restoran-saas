-- Add code column and backfill from name where possible
ALTER TABLE "RestaurantTable" ADD COLUMN "code" TEXT;
UPDATE "RestaurantTable" SET "code" = COALESCE(NULLIF(TRIM(UPPER(REGEXP_REPLACE("name", '[^A-Za-z0-9]+', '-', 'g'))), ''), "id") WHERE "code" IS NULL;
ALTER TABLE "RestaurantTable" ALTER COLUMN "code" SET NOT NULL;

-- Unique code per branch
CREATE UNIQUE INDEX "RestaurantTable_branchId_code_key" ON "RestaurantTable"("branchId", "code");

-- DB-level protection for open sessions
CREATE UNIQUE INDEX "TableSession_single_open_per_table_idx"
ON "TableSession"("tableId")
WHERE "status" IN ('OPEN', 'PAYMENT_PENDING');
