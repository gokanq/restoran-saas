-- CreateTable
CREATE TABLE "LocationDistrict" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationNeighborhood" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationNeighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationDistrict_city_isActive_idx" ON "LocationDistrict"("city", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LocationDistrict_city_name_key" ON "LocationDistrict"("city", "name");

-- CreateIndex
CREATE INDEX "LocationNeighborhood_districtId_isActive_idx" ON "LocationNeighborhood"("districtId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LocationNeighborhood_districtId_name_key" ON "LocationNeighborhood"("districtId", "name");

-- AddForeignKey
ALTER TABLE "LocationNeighborhood" ADD CONSTRAINT "LocationNeighborhood_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "LocationDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
