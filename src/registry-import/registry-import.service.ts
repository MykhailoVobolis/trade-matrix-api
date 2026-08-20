import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { RegistryImportStatus as PrismaRegistryImportStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import {
  REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES,
  REGISTRY_IMPORT_MAX_FILES,
} from './constants/registry-import.constants';
import { RegistryImportItemDto } from './dto/registry-import-item.dto';
import { RegistryImportStatus } from './dto/registry-import-status.dto';
import { RegistryImportStatsDto } from './dto/registry-import-stats.dto';
import { UploadedRegistryImportFile } from './types/registry-import-file.type';
import { RegistryImportRepository } from './registry-import.repository';

type RegistryImportRecord = {
  id: string;
  originalFileName: string;
  status: PrismaRegistryImportStatus;
  fileSizeBytes: bigint;
  rowCount: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

@Injectable()
export class RegistryImportService {
  constructor(
    private readonly registryImportRepository: RegistryImportRepository,
  ) {}

  uploadFiles(
    user: AuthenticatedUser,
    files: UploadedRegistryImportFile[],
  ): Promise<RegistryImportItemDto[]> {
    if (files.length === 0) {
      throw new BadRequestException('At least one XLSX file is required.');
    }

    if (files.length > REGISTRY_IMPORT_MAX_FILES) {
      throw new BadRequestException(
        `No more than ${REGISTRY_IMPORT_MAX_FILES} files can be uploaded at once.`,
      );
    }

    return Promise.all(
      files.map((file) => this.createImportMetadataForFile(user, file)),
    );
  }

  async listImports(user: AuthenticatedUser): Promise<RegistryImportItemDto[]> {
    const imports = await this.registryImportRepository.listByUserId(
      user.userId,
    );

    return imports.map((item) => this.toRegistryImportItemDto(item));
  }

  async getStats(user: AuthenticatedUser): Promise<RegistryImportStatsDto> {
    const [
      completedCount,
      processingCount,
      queuedCount,
      failedCount,
      aggregate,
    ] = await Promise.all([
      this.registryImportRepository.countByUserIdAndStatus(
        user.userId,
        PrismaRegistryImportStatus.completed,
      ),
      this.registryImportRepository.countByUserIdAndStatus(
        user.userId,
        PrismaRegistryImportStatus.processing,
      ),
      this.registryImportRepository.countByUserIdAndStatus(
        user.userId,
        PrismaRegistryImportStatus.queued,
      ),
      this.registryImportRepository.countByUserIdAndStatus(
        user.userId,
        PrismaRegistryImportStatus.failed,
      ),
      this.registryImportRepository.aggregateSizeByUserId(user.userId),
    ]);

    const totalSizeBytes = Number(aggregate._sum.fileSizeBytes ?? 0n);

    return {
      completedCount,
      processingCount,
      queuedCount,
      failedCount,
      totalFiles: aggregate._count._all,
      totalSizeBytes,
      totalSizeMb: Number((totalSizeBytes / (1024 * 1024)).toFixed(1)),
    };
  }

  deleteImport(
    _user: AuthenticatedUser,
    _importId: string,
  ): Promise<MessageResponseDto> {
    void this.registryImportRepository;
    void _user;
    void _importId;
    throw new NotImplementedException(
      'Registry import deletion is not implemented yet.',
    );
  }

  private async createImportMetadataForFile(
    user: AuthenticatedUser,
    file: UploadedRegistryImportFile,
  ): Promise<RegistryImportItemDto> {
    const contentHash = this.buildContentHash(file.buffer);
    const duplicateImport =
      await this.registryImportRepository.findByUserIdAndContentHash(
        user.userId,
        contentHash,
      );

    if (duplicateImport) {
      const failedImport = await this.registryImportRepository.createImport({
        userId: user.userId,
        originalFileName: file.originalname,
        contentHash: this.buildFailedMetadataHash(contentHash),
        fileSizeBytes: BigInt(file.size),
        status: PrismaRegistryImportStatus.failed,
        errorMessage: 'This file has already been uploaded.',
        finishedAt: new Date(),
      });

      return this.toRegistryImportItemDto(failedImport);
    }

    const validationError = this.getFileValidationError(file);
    const importRecord = await this.registryImportRepository.createImport({
      userId: user.userId,
      originalFileName: file.originalname,
      contentHash,
      fileSizeBytes: BigInt(file.size),
      status: validationError
        ? PrismaRegistryImportStatus.failed
        : PrismaRegistryImportStatus.queued,
      errorMessage: validationError,
      finishedAt: validationError ? new Date() : null,
    });

    return this.toRegistryImportItemDto(importRecord);
  }

  private getFileValidationError(
    file: UploadedRegistryImportFile,
  ): string | null {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      return 'Only .xlsx files are supported.';
    }

    if (file.size > REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES) {
      return 'File size must not exceed 10 MB.';
    }

    return null;
  }

  private buildContentHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private buildFailedMetadataHash(contentHash: string): string {
    return `${contentHash}:failed:${randomUUID()}`;
  }

  private toRegistryImportItemDto(
    importRecord: RegistryImportRecord,
  ): RegistryImportItemDto {
    const sizeBytes = Number(importRecord.fileSizeBytes);

    return {
      id: importRecord.id,
      fileName: importRecord.originalFileName,
      status: this.toDtoStatus(importRecord.status),
      sizeBytes,
      sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(1)),
      rowCount: importRecord.rowCount,
      errorMessage: importRecord.errorMessage,
      createdAt: importRecord.createdAt,
      startedAt: importRecord.startedAt,
      finishedAt: importRecord.finishedAt,
    };
  }

  private toDtoStatus(
    status: PrismaRegistryImportStatus,
  ): RegistryImportStatus {
    switch (status) {
      case PrismaRegistryImportStatus.queued:
        return RegistryImportStatus.Queued;
      case PrismaRegistryImportStatus.processing:
        return RegistryImportStatus.Processing;
      case PrismaRegistryImportStatus.completed:
        return RegistryImportStatus.Completed;
      case PrismaRegistryImportStatus.failed:
        return RegistryImportStatus.Failed;
    }
  }
}
