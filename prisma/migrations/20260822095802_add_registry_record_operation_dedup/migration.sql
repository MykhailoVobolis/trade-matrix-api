/*
  Warnings:

  - Added the required column `duplicate_group_key` to the `RegistryRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operation_fingerprint` to the `RegistryRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RegistryRecord" ADD COLUMN     "duplicate_group_key" TEXT NOT NULL,
ADD COLUMN     "is_canonical" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "operation_fingerprint" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_operation_fingerprint_idx" ON "RegistryRecord"("userId", "operation_fingerprint");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_duplicate_group_key_idx" ON "RegistryRecord"("userId", "duplicate_group_key");

-- CreateIndex
CREATE INDEX "RegistryRecord_userId_is_canonical_idx" ON "RegistryRecord"("userId", "is_canonical");
