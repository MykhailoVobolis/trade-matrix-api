-- CreateEnum
CREATE TYPE "RegistryImportStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "RegistryImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "status" "RegistryImportStatus" NOT NULL DEFAULT 'queued',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistryImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "seller_region_code" TEXT,
    "seller_district_code" TEXT,
    "seller_tax_number" TEXT,
    "seller_ipn" TEXT,
    "seller_name" TEXT,
    "seller_status" TEXT,
    "buyer_region_code" TEXT,
    "buyer_district_code" TEXT,
    "buyer_tax_number" TEXT,
    "buyer_ipn" TEXT,
    "buyer_name" TEXT,
    "buyer_status" TEXT,
    "registration_number" TEXT,
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3),
    "registration_date" TIMESTAMP(3),
    "erpn_status" TEXT,
    "is_excluded" BOOLEAN,
    "total_amount_payable" DECIMAL(18,2),
    "total_vat_amount" DECIMAL(18,2),
    "supply_amount_20" DECIMAL(18,2),
    "supply_amount_14" DECIMAL(18,2),
    "supply_amount_7" DECIMAL(18,2),
    "adjustment_count" INTEGER,
    "adjustment_amount" DECIMAL(18,2),
    "unit_price_declared" DECIMAL(18,2),
    "item_description" TEXT,
    "uktzed_code" TEXT,
    "dkpp_code" TEXT,
    "unit_name" TEXT,
    "quantity" DECIMAL(18,3),
    "unit_price_actual" DECIMAL(18,2),
    "supply_amount_without_vat" DECIMAL(18,2),
    "vat_amount" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistryImport_userId_idx" ON "RegistryImport"("userId");

-- CreateIndex
CREATE INDEX "RegistryImport_status_idx" ON "RegistryImport"("status");

-- CreateIndex
CREATE INDEX "RegistryImport_userId_status_idx" ON "RegistryImport"("userId", "status");

-- CreateIndex
CREATE INDEX "RegistryImport_userId_created_at_idx" ON "RegistryImport"("userId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryImport_userId_contentHash_key" ON "RegistryImport"("userId", "contentHash");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_idx" ON "RegistryRecord"("userId");

-- CreateIndex
CREATE INDEX "RegistryRecord_importId_idx" ON "RegistryRecord"("importId");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_seller_ipn_idx" ON "RegistryRecord"("userId", "seller_ipn");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_seller_name_idx" ON "RegistryRecord"("userId", "seller_name");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_buyer_ipn_idx" ON "RegistryRecord"("userId", "buyer_ipn");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_buyer_name_idx" ON "RegistryRecord"("userId", "buyer_name");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_invoice_date_idx" ON "RegistryRecord"("userId", "invoice_date");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_total_amount_payable_idx" ON "RegistryRecord"("userId", "total_amount_payable");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_uktzed_code_idx" ON "RegistryRecord"("userId", "uktzed_code");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_unit_price_actual_idx" ON "RegistryRecord"("userId", "unit_price_actual");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_seller_region_code_idx" ON "RegistryRecord"("userId", "seller_region_code");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_buyer_region_code_idx" ON "RegistryRecord"("userId", "buyer_region_code");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_seller_district_code_idx" ON "RegistryRecord"("userId", "seller_district_code");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_buyer_district_code_idx" ON "RegistryRecord"("userId", "buyer_district_code");

-- AddForeignKey
ALTER TABLE "RegistryImport" ADD CONSTRAINT "RegistryImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistryRecord" ADD CONSTRAINT "RegistryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistryRecord" ADD CONSTRAINT "RegistryRecord_importId_fkey" FOREIGN KEY ("importId") REFERENCES "RegistryImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
