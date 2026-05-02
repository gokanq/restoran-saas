-- Archived / soft-deleted tables should not block table code reuse.
-- Keep table code unique only among visible, non-deleted tables.

DROP INDEX IF EXISTS "RestaurantTable_branchId_code_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'RestaurantTable'
      AND constraint_name = 'RestaurantTable_branchId_code_key'
  ) THEN
    ALTER TABLE "RestaurantTable" DROP CONSTRAINT "RestaurantTable_branchId_code_key";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_branchId_code_active_key"
ON "RestaurantTable"("branchId", "code")
WHERE "deletedAt" IS NULL;
