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
}
