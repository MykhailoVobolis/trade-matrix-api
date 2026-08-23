-- CreateIndex
CREATE INDEX "RegistryRecord_userId_seller_tax_number_idx" ON "RegistryRecord"("userId", "seller_tax_number");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_buyer_tax_number_idx" ON "RegistryRecord"("userId", "buyer_tax_number");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_invoice_date_seller_tax_number_idx" ON "RegistryRecord"("userId", "invoice_date", "seller_tax_number");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_invoice_date_buyer_tax_number_idx" ON "RegistryRecord"("userId", "invoice_date", "buyer_tax_number");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_invoice_date_buyer_region_code_idx" ON "RegistryRecord"("userId", "invoice_date", "buyer_region_code");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_invoice_date_uktzed_code_idx" ON "RegistryRecord"("userId", "invoice_date", "uktzed_code");
