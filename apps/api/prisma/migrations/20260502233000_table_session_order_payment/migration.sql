-- Table service payment/order bridge

ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
ALTER TABLE "TableSession" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE INDEX IF NOT EXISTS "TableSession_orderId_idx" ON "TableSession"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TableSession_orderId_fkey'
  ) THEN
    ALTER TABLE "TableSession"
    ADD CONSTRAINT "TableSession_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
