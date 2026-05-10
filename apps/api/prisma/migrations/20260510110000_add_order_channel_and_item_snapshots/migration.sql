-- Add order channel and order item pricing snapshots.
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "channel" "MenuChannel" NOT NULL DEFAULT 'CALLER_ID';

ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "basePriceSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "channelSnapshot" "MenuChannel",
ADD COLUMN IF NOT EXISTS "appliedPriceSource" TEXT NOT NULL DEFAULT 'BASE';

UPDATE "OrderItem"
SET "basePriceSnapshot" = "unitPrice"
WHERE "basePriceSnapshot" = 0;

UPDATE "OrderItem" AS oi
SET "channelSnapshot" = o."channel"
FROM "Order" AS o
WHERE oi."orderId" = o."id"
  AND oi."channelSnapshot" IS NULL;
