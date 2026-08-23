import { Injectable } from '@nestjs/common';
import { Prisma, RegistryImportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateRegistryImportInput = {
  userId: string;
  originalFileName: string;
  contentHash: string;
  fileSizeBytes: bigint;
  status: RegistryImportStatus;
  rowCount?: number;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export type ListRegistryRecordsParams = {
  userId: string;
  where: Prisma.RegistryRecordWhereInput;
  skip: number;
  take: number;
  orderBy: Prisma.RegistryRecordOrderByWithRelationInput;
};

export type ListRegistryImportsParams = {
  userId: string;
  where: Prisma.RegistryImportWhereInput;
  skip: number;
  take: number;
};

@Injectable()
export class RegistryImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOwnedImportById(importId: string, userId: string) {
    return this.prisma.registryImport.findFirst({
      where: {
        id: importId,
        userId,
      },
    });
  }

  findByUserIdAndContentHash(userId: string, contentHash: string) {
    return this.prisma.registryImport.findFirst({
      where: {
        userId,
        contentHash,
      },
    });
  }

  createImport(data: CreateRegistryImportInput) {
    return this.prisma.registryImport.create({
      data,
    });
  }

  createManyRecords(data: Prisma.RegistryRecordCreateManyInput[]) {
    return this.prisma.registryRecord.createMany({
      data,
    });
  }

  async reconcileCanonicalRecords(
    userId: string,
    operationFingerprints: string[],
  ): Promise<void> {
    if (operationFingerprints.length === 0) {
      return;
    }

    await this.prisma.$executeRaw`
      UPDATE "RegistryRecord" AS record
      SET "is_canonical" = CASE WHEN ranked.row_number = 1 THEN TRUE ELSE FALSE END
      FROM (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "userId", "operation_fingerprint"
            ORDER BY "created_at" ASC, "id" ASC
          ) AS row_number
        FROM "RegistryRecord"
        WHERE
          "userId" = ${userId}
          AND "operation_fingerprint" IN (${Prisma.join(operationFingerprints)})
      ) AS ranked
      WHERE record."id" = ranked."id"
    `;
  }

  listImports(params: ListRegistryImportsParams) {
    return this.prisma.registryImport.findMany({
      where: {
        userId: params.userId,
        ...params.where,
      },
      skip: params.skip,
      take: params.take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  countImports(userId: string, where: Prisma.RegistryImportWhereInput) {
    return this.prisma.registryImport.count({
      where: {
        userId,
        ...where,
      },
    });
  }

  countByUserIdAndStatus(userId: string, status: RegistryImportStatus) {
    return this.prisma.registryImport.count({
      where: {
        userId,
        status,
      },
    });
  }

  aggregateSizeByUserId(userId: string) {
    return this.prisma.registryImport.aggregate({
      where: { userId },
      _sum: {
        fileSizeBytes: true,
      },
      _count: {
        _all: true,
      },
    });
  }

  markProcessing(importId: string) {
    return this.prisma.registryImport.update({
      where: { id: importId },
      data: {
        status: RegistryImportStatus.processing,
        startedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  markCompleted(importId: string, rowCount: number) {
    return this.prisma.registryImport.update({
      where: { id: importId },
      data: {
        status: RegistryImportStatus.completed,
        rowCount,
        finishedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  markFailed(importId: string, errorMessage: string) {
    return this.prisma.registryImport.update({
      where: { id: importId },
      data: {
        status: RegistryImportStatus.failed,
        finishedAt: new Date(),
        errorMessage,
      },
    });
  }

  deleteRecordsByImportId(importId: string) {
    return this.prisma.registryRecord.deleteMany({
      where: { importId },
    });
  }

  deleteImportById(importId: string) {
    return this.prisma.registryImport.delete({
      where: { id: importId },
    });
  }

  async deleteImportWithRecords(importId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.registryRecord.deleteMany({
        where: { importId },
      }),
      this.prisma.registryImport.delete({
        where: { id: importId },
      }),
    ]);
  }

  listRecords(params: ListRegistryRecordsParams) {
    return this.prisma.registryRecord.findMany({
      where: {
        userId: params.userId,
        ...params.where,
      },
      skip: params.skip,
      take: params.take,
      orderBy: params.orderBy,
    });
  }

  countRecords(userId: string, where: Prisma.RegistryRecordWhereInput) {
    return this.prisma.registryRecord.count({
      where: {
        userId,
        ...where,
      },
    });
  }
}
