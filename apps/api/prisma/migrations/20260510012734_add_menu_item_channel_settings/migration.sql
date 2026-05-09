-- Merkezi menu kanal altyapisi
-- QR / Masa Servis / Caller ID / Mobil / WhatsApp icin kanal bazli ac-kapa ve fiyat desteği

CREATE TYPE "MenuChannel" AS ENUM ('QR', 'TABLE_SERVICE', 'CALLER_ID', 'MOBILE', 'WHATSAPP');

ALTER TABLE "MenuItem"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "MenuItemChannelSetting" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "channel" "MenuChannel" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemChannelSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuItemChannelSetting_restaurantId_idx"
ON "MenuItemChannelSetting"("restaurantId");

CREATE INDEX "MenuItemChannelSetting_branchId_idx"
ON "MenuItemChannelSetting"("branchId");

CREATE INDEX "MenuItemChannelSetting_channel_idx"
ON "MenuItemChannelSetting"("channel");

CREATE UNIQUE INDEX "MenuItemChannelSetting_menuItemId_channel_key"
ON "MenuItemChannelSetting"("menuItemId", "channel");

ALTER TABLE "MenuItemChannelSetting"
ADD CONSTRAINT "MenuItemChannelSetting_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MenuItemChannelSetting"
ADD CONSTRAINT "MenuItemChannelSetting_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MenuItemChannelSetting"
ADD CONSTRAINT "MenuItemChannelSetting_menuItemId_fkey"
FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
