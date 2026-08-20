import { Injectable } from '@nestjs/common';
import { RegistryImportStatus } from '@prisma/client';
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

@Injectable()
export class RegistryImportRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
