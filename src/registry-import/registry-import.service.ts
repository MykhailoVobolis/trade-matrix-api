import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { RegistryImportStatus as PrismaRegistryImportStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { read, utils } from 'xlsx';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import {
  REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES,
  REGISTRY_IMPORT_MAX_FILES,
  REGISTRY_IMPORT_REQUIRED_HEADERS,
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

    if (validationError) {
      return this.toRegistryImportItemDto(importRecord);
    }

    return this.processWorkbookImport(importRecord.id, file);
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

  private async processWorkbookImport(
    importId: string,
    file: UploadedRegistryImportFile,
  ): Promise<RegistryImportItemDto> {
    await this.registryImportRepository.markProcessing(importId);

    try {
      const workbook = read(file.buffer, {
        type: 'buffer',
        dense: true,
      });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        const failedImport = await this.registryImportRepository.markFailed(
          importId,
          'The workbook does not contain any sheets.',
        );

        return this.toRegistryImportItemDto(failedImport);
      }

      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = utils.sheet_to_json<(string | number | boolean | null)[]>(
        firstSheet,
        {
          header: 1,
          raw: false,
          defval: null,
          blankrows: false,
        },
      );

      if (rows.length === 0) {
        const failedImport = await this.registryImportRepository.markFailed(
          importId,
          'The worksheet is empty.',
        );

        return this.toRegistryImportItemDto(failedImport);
      }

      const headerRow = rows[0].map((value) => this.normalizeCellValue(value));
      const missingHeaders = this.getMissingHeaders(headerRow);

      if (missingHeaders.length > 0) {
        const failedImport = await this.registryImportRepository.markFailed(
          importId,
          `Missing required columns: ${missingHeaders.join(', ')}.`,
        );

        return this.toRegistryImportItemDto(failedImport);
      }

      const dataRows = this.getNormalizedDataRows(rows.slice(1));
      const completedImport = await this.registryImportRepository.markCompleted(
        importId,
        dataRows.length,
      );

      return this.toRegistryImportItemDto(completedImport);
    } catch {
      const failedImport = await this.registryImportRepository.markFailed(
        importId,
        'Failed to parse the XLSX file.',
      );

      return this.toRegistryImportItemDto(failedImport);
    }
  }

  private getMissingHeaders(headerRow: string[]): string[] {
    const actualCounts = new Map<string, number>();

    for (const header of headerRow) {
      if (!header) {
        continue;
      }

      actualCounts.set(header, (actualCounts.get(header) ?? 0) + 1);
    }

    const missingHeaders: string[] = [];
    const requiredCounts = new Map<string, number>();

    for (const requiredHeader of REGISTRY_IMPORT_REQUIRED_HEADERS) {
      requiredCounts.set(
        requiredHeader,
        (requiredCounts.get(requiredHeader) ?? 0) + 1,
      );
    }

    for (const [header, requiredCount] of requiredCounts) {
      const actualCount = actualCounts.get(header) ?? 0;

      for (let index = actualCount; index < requiredCount; index += 1) {
        missingHeaders.push(header);
      }
    }

    return missingHeaders;
  }

  private getNormalizedDataRows(
    rows: (string | number | boolean | null)[][],
  ): string[][] {
    const normalizedRows = rows.map((row) =>
      row.map((value) => this.normalizeCellValue(value)),
    );

    let lastNonEmptyRowIndex = -1;

    normalizedRows.forEach((row, index) => {
      if (row.some((value) => value.length > 0)) {
        lastNonEmptyRowIndex = index;
      }
    });

    if (lastNonEmptyRowIndex === -1) {
      return [];
    }

    return normalizedRows
      .slice(0, lastNonEmptyRowIndex + 1)
      .filter((row) => row.some((value) => value.length > 0));
  }

  private normalizeCellValue(
    value: string | number | boolean | null | undefined,
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
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
