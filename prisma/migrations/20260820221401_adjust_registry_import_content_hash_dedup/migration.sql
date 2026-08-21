-- DropIndex
DROP INDEX "RegistryImport_userId_contentHash_key";

-- CreateIndex
CREATE INDEX "RegistryImport_userId_contentHash_idx" ON "RegistryImport"("userId", "contentHash");
