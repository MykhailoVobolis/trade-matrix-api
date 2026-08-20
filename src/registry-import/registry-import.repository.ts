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

  listByUserId(userId: string) {
    return this.prisma.registryImport.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
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
