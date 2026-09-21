import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RegistryImportStatus as PrismaRegistryImportStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { read, utils } from 'xlsx';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { ListRegistryImportsQueryDto } from './dto/list-registry-imports-query.dto';
import { ListRegistryRecordsQueryDto } from './dto/list-registry-records-query.dto';
import {
  REGISTRY_IMPORT_COLUMN_SPECS,
  type RegistryImportColumnSpec,
  REGISTRY_IMPORT_INSERT_BATCH_SIZE,
  REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES,
  REGISTRY_IMPORT_MAX_FILES,
  REGISTRY_IMPORT_MAX_TOTAL_SIZE_BYTES,
  REGISTRY_IMPORT_QUEUE_ATTEMPTS,
  REGISTRY_IMPORT_QUEUE_BACKOFF_MS,
  REGISTRY_IMPORT_REQUIRED_HEADERS,
  REGISTRY_IMPORT_STALE_TIMEOUT_MS,
  REGISTRY_IMPORT_SUPPORTED_EXTENSIONS,
} from './constants/registry-import.constants';
import { RegistryImportItemDto } from './dto/registry-import-item.dto';
import { RegistryImportFileType } from './dto/registry-import-item.dto';
import { RegistryImportListResponseDto } from './dto/registry-import-list-response.dto';
import { RegistryImportStatus } from './dto/registry-import-status.dto';
import { RegistryImportStatsDto } from './dto/registry-import-stats.dto';
import { RegistryRecordItemDto } from './dto/registry-record-item.dto';
import { RegistryRecordListResponseDto } from './dto/registry-record-list-response.dto';
import { ParsedRegistryRecord } from './types/parsed-registry-record.type';
import { UploadedRegistryImportFile } from './types/registry-import-file.type';
import { RegistryImportRepository } from './registry-import.repository';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  REGISTRY_IMPORT_QUEUE_NAME,
  RegistryImportJobData,
} from './registry-import.queue';

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

type ParsedWorkbook = {
  firstSheetName: string | null;
  rows: (string | number | boolean | Date | null)[][];
};

type DenseWorksheetCell = {
  t?: string;
  v?: unknown;
  w?: string;
};

type RegistryRecordListItem = {
  id: string;
  importId: string;
  rowNumber: number;
  sellerRegionCode: string | null;
  sellerDistrictCode: string | null;
  sellerIpn: string | null;
  sellerName: string | null;
  buyerRegionCode: string | null;
  buyerDistrictCode: string | null;
  buyerIpn: string | null;
  buyerName: string | null;
  invoiceDate: Date | null;
  itemDescription: string | null;
  uktzedCode: string | null;
  unitName: string | null;
  unitPriceActual: Prisma.Decimal | null;
  createdAt: Date;
};

type RegistryRecordCreateInputDraft = Prisma.RegistryRecordCreateManyInput & {
  operationFingerprint: string;
  duplicateGroupKey: string;
  isCanonical: boolean;
};

@Injectable()
export class RegistryImportService {
  private readonly pendingFiles = new Map<string, UploadedRegistryImportFile>();

  constructor(
    private readonly registryImportRepository: RegistryImportRepository,
    @InjectQueue(REGISTRY_IMPORT_QUEUE_NAME)
    private readonly registryImportQueue: Queue<RegistryImportJobData>,
  ) {}

  async uploadFiles(
    user: AuthenticatedUser,
    files: UploadedRegistryImportFile[],
  ): Promise<RegistryImportItemDto[]> {
    if (files.length === 0) {
      throw new BadRequestException(
        'At least one XLSX or CSV file is required.',
      );
    }

    if (files.length > REGISTRY_IMPORT_MAX_FILES) {
      throw new BadRequestException(
        `No more than ${REGISTRY_IMPORT_MAX_FILES} files can be uploaded at once.`,
      );
    }

    const totalSizeBytes = files.reduce((total, file) => total + file.size, 0);

    if (totalSizeBytes > REGISTRY_IMPORT_MAX_TOTAL_SIZE_BYTES) {
      throw new BadRequestException(
        `The total upload size must not exceed ${REGISTRY_IMPORT_MAX_TOTAL_SIZE_BYTES} bytes.`,
      );
    }

    return Promise.all(
      files.map((file) => this.createImportMetadataForFile(user, file)),
    );
  }

  async listImports(
    user: AuthenticatedUser,
    query: ListRegistryImportsQueryDto,
  ): Promise<RegistryImportListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 5;
    const skip = (page - 1) * perPage;
    const where = this.buildRegistryImportWhere(query);

    const [imports, total] = await Promise.all([
      this.registryImportRepository.listImports({
        userId: user.userId,
        where,
        skip,
        take: perPage,
      }),
      this.registryImportRepository.countImports(user.userId, where),
    ]);

    return {
      items: imports.map((item) => this.toRegistryImportItemDto(item)),
      total,
      page,
      perPage,
    };
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

  async listRecords(
    user: AuthenticatedUser,
    query: ListRegistryRecordsQueryDto,
  ): Promise<RegistryRecordListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 50;
    const skip = (page - 1) * perPage;
    const where = this.buildRegistryRecordWhere(query);
    const orderBy = this.buildRegistryRecordOrderBy(
      query.sortBy ?? 'invoiceDate',
      query.sortOrder ?? 'desc',
    );

    const [items, total] = await Promise.all([
      this.registryImportRepository.listRecords({
        userId: user.userId,
        where,
        skip,
        take: perPage,
        orderBy,
      }),
      this.registryImportRepository.countRecords(user.userId, where),
    ]);

    return {
      items: items.map((item) => this.toRegistryRecordItemDto(item)),
      total,
      page,
      perPage,
    };
  }

  async deleteImport(
    user: AuthenticatedUser,
    importId: string,
  ): Promise<MessageResponseDto> {
    const ownedImport = await this.registryImportRepository.findOwnedImportById(
      importId,
      user.userId,
    );

    if (!ownedImport) {
      throw new NotFoundException('Registry import not found');
    }

    await this.registryImportRepository.deleteImportWithRecords(importId);

    return {
      message: 'Registry import deleted successfully.',
    };
  }

  private async createImportMetadataForFile(
    user: AuthenticatedUser,
    file: UploadedRegistryImportFile,
  ): Promise<RegistryImportItemDto> {
    const normalizedFileName = this.normalizeUploadedFileName(
      file.originalname,
    );
    const contentHash = this.buildContentHash(file.buffer);
    const duplicateImport =
      await this.registryImportRepository.findByUserIdAndContentHash(
        user.userId,
        contentHash,
      );

    if (duplicateImport) {
      const failedImport = await this.registryImportRepository.createImport({
        userId: user.userId,
        originalFileName: normalizedFileName,
        contentHash,
        fileSizeBytes: BigInt(file.size),
        status: PrismaRegistryImportStatus.failed,
        errorMessage: 'This file has already been uploaded.',
        finishedAt: new Date(),
      });

      return this.toRegistryImportItemDto(failedImport);
    }

    const validationError = this.getFileValidationError(
      normalizedFileName,
      file.size,
    );
    const importRecord = await this.registryImportRepository.createImport({
      userId: user.userId,
      originalFileName: normalizedFileName,
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

    this.pendingFiles.set(importRecord.id, file);
    try {
      await this.registryImportQueue.add(
        'process',
        {
          importId: importRecord.id,
          userId: user.userId,
        },
        {
          jobId: importRecord.id,
          attempts: REGISTRY_IMPORT_QUEUE_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: REGISTRY_IMPORT_QUEUE_BACKOFF_MS,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch {
      this.pendingFiles.delete(importRecord.id);
      const failedImport = await this.registryImportRepository.markFailed(
        importRecord.id,
        'Failed to add the spreadsheet to the processing queue.',
      );

      return this.toRegistryImportItemDto(failedImport);
    }

    return this.toRegistryImportItemDto(importRecord);
  }

  private getFileValidationError(
    fileName: string,
    fileSizeBytes: number,
  ): string | null {
    const normalizedFileName = fileName.toLowerCase();

    if (
      !REGISTRY_IMPORT_SUPPORTED_EXTENSIONS.some((extension) =>
        normalizedFileName.endsWith(extension),
      )
    ) {
      return 'Only .xlsx and .csv files are supported.';
    }

    if (fileSizeBytes > REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES) {
      return 'File size must not exceed 10 MB.';
    }

    return null;
  }

  private normalizeUploadedFileName(fileName: string): string {
    const normalizedInput = fileName.normalize('NFC');

    if (!this.looksLikeMultipartMojibake(normalizedInput)) {
      return normalizedInput;
    }

    const decoded = Buffer.from(normalizedInput, 'latin1')
      .toString('utf8')
      .normalize('NFC');

    return this.looksLikeMultipartMojibake(decoded) ? normalizedInput : decoded;
  }

  private looksLikeMultipartMojibake(value: string): boolean {
    return /(?:Ã.|Ð.|Ñ.)/u.test(value);
  }

  private buildContentHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async processQueuedImport({
    importId,
    userId,
  }: RegistryImportJobData): Promise<void> {
    const file = this.pendingFiles.get(importId);

    if (!file) {
      await this.registryImportRepository.markFailed(
        importId,
        'The uploaded file is no longer available in the current process.',
      );
      return;
    }

    await this.processWorkbookImport(importId, userId, file);
    this.pendingFiles.delete(importId);
  }

  async getImportStatus(
    importId: string,
  ): Promise<PrismaRegistryImportStatus | null> {
    const importRecord =
      await this.registryImportRepository.findStatusById(importId);

    return importRecord?.status ?? null;
  }

  async markQueueJobFailed(
    importId: string,
    errorMessage: string,
  ): Promise<void> {
    this.pendingFiles.delete(importId);
    await this.registryImportRepository.deleteRecordsByImportId(importId);
    await this.registryImportRepository.markFailed(importId, errorMessage);
  }

  async recoverStaleImports(): Promise<void> {
    const staleBefore = new Date(Date.now() - REGISTRY_IMPORT_STALE_TIMEOUT_MS);

    await this.registryImportRepository.markStaleImportsFailed(
      staleBefore,
      'Import processing timed out and was stopped.',
    );
  }

  private async processWorkbookImport(
    importId: string,
    userId: string,
    file: UploadedRegistryImportFile,
  ): Promise<RegistryImportItemDto> {
    await this.registryImportRepository.markProcessing(importId);

    try {
      const { firstSheetName, rows } = this.parseSpreadsheetRows(file);

      if (!firstSheetName) {
        const failedImport = await this.registryImportRepository.markFailed(
          importId,
          'The spreadsheet does not contain any sheets.',
        );

        return this.toRegistryImportItemDto(failedImport);
      }

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

      const columnIndexes = this.buildColumnIndexes(headerRow);
      const dataRows = this.getNormalizedDataRows(rows.slice(1));
      const parsedRows = dataRows.map((row, index) =>
        this.mapRowToParsedRecord(row, index + 2, columnIndexes),
      );
      const operationFingerprints = await this.persistParsedRows(
        importId,
        userId,
        parsedRows,
      );
      await this.registryImportRepository.reconcileCanonicalRecords(
        userId,
        operationFingerprints,
      );
      const currentStatus = await this.getImportStatus(importId);

      if (currentStatus !== PrismaRegistryImportStatus.processing) {
        throw new Error('Registry import processing timed out.');
      }

      const completedImport = await this.registryImportRepository.markCompleted(
        importId,
        parsedRows.length,
      );

      return this.toRegistryImportItemDto(completedImport);
    } catch (error) {
      await this.registryImportRepository.deleteRecordsByImportId(importId);
      throw error;
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

  private buildColumnIndexes(headerRow: string[]): Map<string, number[]> {
    const headerIndexes = new Map<string, number[]>();

    headerRow.forEach((header, index) => {
      if (!header) {
        return;
      }

      const indexes = headerIndexes.get(header) ?? [];
      indexes.push(index);
      headerIndexes.set(header, indexes);
    });

    return headerIndexes;
  }

  private mapRowToParsedRecord(
    row: string[],
    rowNumber: number,
    columnIndexes: Map<string, number[]>,
  ): ParsedRegistryRecord {
    const record: ParsedRegistryRecord = { rowNumber };

    for (const columnSpec of REGISTRY_IMPORT_COLUMN_SPECS) {
      record[columnSpec.field] = this.getMappedCellValue(
        row,
        columnIndexes,
        columnSpec,
      );
    }

    return record;
  }

  private getMappedCellValue(
    row: string[],
    columnIndexes: Map<string, number[]>,
    columnSpec: RegistryImportColumnSpec,
  ): string {
    const indexes = columnIndexes.get(columnSpec.header) ?? [];
    const targetIndex = indexes[columnSpec.occurrence - 1];

    if (targetIndex === undefined) {
      return '';
    }

    return row[targetIndex] ?? '';
  }

  private async persistParsedRows(
    importId: string,
    userId: string,
    parsedRows: ParsedRegistryRecord[],
  ): Promise<string[]> {
    const operationFingerprints = new Set<string>();

    for (
      let index = 0;
      index < parsedRows.length;
      index += REGISTRY_IMPORT_INSERT_BATCH_SIZE
    ) {
      const batch = parsedRows
        .slice(index, index + REGISTRY_IMPORT_INSERT_BATCH_SIZE)
        .map((row) =>
          this.toRegistryRecordCreateManyInputDraft(importId, userId, row),
        );

      batch.forEach((row) => {
        operationFingerprints.add(row.operationFingerprint);
      });

      await this.registryImportRepository.createManyRecords(batch);
    }

    return [...operationFingerprints];
  }

  private toRegistryRecordCreateManyInputDraft(
    importId: string,
    userId: string,
    row: ParsedRegistryRecord,
  ): RegistryRecordCreateInputDraft {
    const sellerTaxNumber = this.toOptionalNumericIdentifier(
      row.sellerTaxNumber,
    );
    const sellerIpn = this.toOptionalNumericIdentifier(row.sellerIpn);
    const buyerTaxNumber = this.toOptionalNumericIdentifier(row.buyerTaxNumber);
    const buyerIpn = this.toOptionalNumericIdentifier(row.buyerIpn);
    const registrationNumber = this.toOptionalString(row.registrationNumber);
    const invoiceNumber = this.toOptionalString(row.invoiceNumber);
    const invoiceDate = this.toOptionalDate(row.invoiceDate);
    const supplyAmountWithoutVat = this.toOptionalDecimal(
      row.supplyAmountWithoutVat,
    );
    const vatAmount = this.toOptionalDecimal(row.vatAmount);
    const itemDescription = this.toOptionalString(row.itemDescription);
    const unitName = this.toOptionalString(row.unitName);
    const quantity = this.toOptionalDecimal(row.quantity);
    const uktzedCode = this.normalizeUktzedCode(row.uktzedCode);
    const amountWithVat = this.sumDecimalStrings(
      supplyAmountWithoutVat,
      vatAmount,
    );
    const operationFingerprint = this.buildOperationFingerprint({
      registrationNumber,
      invoiceNumber,
      invoiceDate,
      sellerTaxNumber,
      buyerTaxNumber,
      itemDescription,
      unitName,
      quantity,
      supplyAmountWithoutVat,
      vatAmount,
      amountWithVat,
      uktzedCode,
    });

    return {
      id: randomUUID(),
      userId,
      importId,
      rowNumber: row.rowNumber,
      sellerRegionCode: this.toOptionalString(row.sellerRegionCode),
      sellerDistrictCode: this.toOptionalString(row.sellerDistrictCode),
      sellerTaxNumber,
      sellerIpn,
      sellerName: this.toOptionalString(row.sellerName),
      sellerStatus: this.toOptionalString(row.sellerStatus),
      buyerRegionCode: this.toOptionalString(row.buyerRegionCode),
      buyerDistrictCode: this.toOptionalString(row.buyerDistrictCode),
      buyerTaxNumber,
      buyerIpn,
      buyerName: this.toOptionalString(row.buyerName),
      buyerStatus: this.toOptionalString(row.buyerStatus),
      registrationNumber,
      invoiceNumber,
      invoiceDate,
      registrationDate: this.toOptionalDate(row.registrationDate),
      erpnStatus: this.toOptionalString(row.erpnStatus),
      isExcluded: this.toOptionalBoolean(row.isExcluded),
      totalAmountPayable: this.toOptionalDecimal(row.totalAmountPayable),
      totalVatAmount: this.toOptionalDecimal(row.totalVatAmount),
      supplyAmount20: this.toOptionalDecimal(row.supplyAmount20),
      supplyAmount14: this.toOptionalDecimal(row.supplyAmount14),
      supplyAmount7: this.toOptionalDecimal(row.supplyAmount7),
      adjustmentCount: this.toOptionalInt(row.adjustmentCount),
      adjustmentAmount: this.toOptionalDecimal(row.adjustmentAmount),
      unitPriceDeclared: this.toOptionalDecimal(row.unitPriceDeclared),
      itemDescription,
      uktzedCode,
      dkppCode: this.toOptionalString(row.dkppCode),
      unitName,
      quantity,
      unitPriceActual: this.toOptionalDecimal(row.unitPriceActual),
      supplyAmountWithoutVat,
      vatAmount,
      operationFingerprint,
      duplicateGroupKey: operationFingerprint,
      isCanonical: true,
    };
  }

  private getNormalizedDataRows(
    rows: (string | number | boolean | Date | null)[][],
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
    value: string | number | boolean | Date | null | undefined,
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? ''
        : value.toISOString().slice(0, 10);
    }

    return String(value)
      .replace(/^\uFEFF/u, '')
      .trim();
  }

  private toOptionalString(value: string | undefined): string | null {
    const normalized = value?.normalize('NFC').trim();

    return normalized ? normalized : null;
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/gu, ' ').trim();
  }

  private toOptionalNumericIdentifier(
    value: string | undefined,
  ): string | null {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    return this.normalizeScientificNotation(normalized) ?? normalized;
  }

  private normalizeScientificNotation(value: string): string | null {
    const compact = value.replaceAll(' ', '').replace(',', '.');
    const match = /^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(compact);

    if (!match) {
      return null;
    }

    const [, integerPart, fractionalPart = '', exponentRaw] = match;
    const exponent = Number.parseInt(exponentRaw, 10);

    if (Number.isNaN(exponent)) {
      return null;
    }

    const sign = integerPart.startsWith('-') ? '-' : '';
    const unsignedIntegerPart =
      integerPart.startsWith('-') || integerPart.startsWith('+')
        ? integerPart.slice(1)
        : integerPart;
    const digits = `${unsignedIntegerPart}${fractionalPart}`;
    const decimalShift = exponent - fractionalPart.length;

    if (decimalShift < 0) {
      const decimalPosition = digits.length + decimalShift;

      if (decimalPosition <= 0) {
        return null;
      }

      const integerDigits = digits.slice(0, decimalPosition);
      const fractionalDigits = digits
        .slice(decimalPosition)
        .replace(/0+$/u, '');

      return fractionalDigits.length > 0 ? null : `${sign}${integerDigits}`;
    }

    return `${sign}${digits}${'0'.repeat(decimalShift)}`;
  }

  private toOptionalDecimal(value: string | undefined): string | null {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const decimal = normalized.replaceAll(' ', '').replace(',', '.');

    if (!/^-?\d+(?:\.\d+)?$/u.test(decimal)) {
      return null;
    }

    return this.normalizeDecimalString(decimal);
  }

  private toOptionalInt(value: string | undefined): number | null {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const integer = Number.parseInt(normalized.replaceAll(' ', ''), 10);

    return Number.isNaN(integer) ? null : integer;
  }

  private toOptionalBoolean(value: string | undefined): boolean | null {
    const normalized = this.toOptionalString(value)?.toLowerCase();

    if (!normalized) {
      return null;
    }

    if (['1', 'true', 'yes', 'y', 'так', 'т'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'n', 'ні', 'н'].includes(normalized)) {
      return false;
    }

    return null;
  }

  private toOptionalDate(value: string | undefined): Date | null {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const dotSeparatedMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/u.exec(
      normalized,
    );

    if (dotSeparatedMatch) {
      const [, day, month, year] = dotSeparatedMatch;
      const date = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day)),
      );

      return Number.isNaN(date.getTime()) ? null : date;
    }

    const isoSeparatedMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(normalized);

    if (isoSeparatedMatch) {
      const [, year, month, day] = isoSeparatedMatch;
      const date = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day)),
      );

      return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  private normalizeUktzedCode(value: string | undefined): string | null {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    return this.normalizeWhitespace(normalized).replace(/\.0+$/u, '');
  }

  private normalizeDecimalString(value: string): string {
    return new Prisma.Decimal(value).toFixed();
  }

  private sumDecimalStrings(
    left: string | null,
    right: string | null,
  ): string | null {
    if (!left && !right) {
      return null;
    }

    const total = new Prisma.Decimal(left ?? '0').plus(
      new Prisma.Decimal(right ?? '0'),
    );

    return total.toFixed();
  }

  private formatDateForFingerprint(value: Date | null): string {
    if (!value) {
      return '';
    }

    return value.toISOString().slice(0, 10);
  }

  private normalizeTextForFingerprint(value: string | null): string {
    return value ? this.normalizeWhitespace(value.normalize('NFC')) : '';
  }

  private normalizeNumericForFingerprint(value: string | null): string {
    return value ? this.normalizeDecimalString(value) : '';
  }

  private buildOperationFingerprint(parts: {
    registrationNumber: string | null;
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    sellerTaxNumber: string | null;
    buyerTaxNumber: string | null;
    itemDescription: string | null;
    unitName: string | null;
    quantity: string | null;
    supplyAmountWithoutVat: string | null;
    vatAmount: string | null;
    amountWithVat: string | null;
    uktzedCode: string | null;
  }): string {
    const fingerprintPayload = [
      this.normalizeTextForFingerprint(parts.registrationNumber),
      this.normalizeTextForFingerprint(parts.invoiceNumber),
      this.formatDateForFingerprint(parts.invoiceDate),
      this.normalizeTextForFingerprint(parts.sellerTaxNumber),
      this.normalizeTextForFingerprint(parts.buyerTaxNumber),
      this.normalizeTextForFingerprint(parts.itemDescription),
      this.normalizeTextForFingerprint(parts.unitName),
      this.normalizeNumericForFingerprint(parts.quantity),
      this.normalizeNumericForFingerprint(parts.supplyAmountWithoutVat),
      this.normalizeNumericForFingerprint(parts.vatAmount),
      this.normalizeNumericForFingerprint(parts.amountWithVat),
      this.normalizeTextForFingerprint(parts.uktzedCode),
    ].join('|');

    return createHash('sha256').update(fingerprintPayload).digest('hex');
  }

  private buildRegistryRecordWhere(
    query: ListRegistryRecordsQueryDto,
  ): Prisma.RegistryRecordWhereInput {
    return {
      sellerRegionCode: this.exactFilter(query.sellerRegionCode),
      sellerDistrictCode: this.exactFilter(query.sellerDistrictCode),
      sellerIpn: this.exactFilter(query.sellerIpn),
      sellerName: this.containsFilter(query.sellerName),
      buyerRegionCode: this.exactFilter(query.buyerRegionCode),
      buyerDistrictCode: this.exactFilter(query.buyerDistrictCode),
      buyerIpn: this.exactFilter(query.buyerIpn),
      buyerName: this.containsFilter(query.buyerName),
      itemDescription: this.containsFilter(query.itemDescription),
      uktzedCode: this.exactFilter(query.uktzedCode),
      unitName: this.containsFilter(query.unitName),
      invoiceDate: this.buildInvoiceDateRange(
        query.invoiceDateFrom,
        query.invoiceDateTo,
      ),
    };
  }

  private buildRegistryImportWhere(
    query: ListRegistryImportsQueryDto,
  ): Prisma.RegistryImportWhereInput {
    return {
      status: query.status,
      originalFileName: query.search
        ? {
            contains: query.search.trim(),
            mode: 'insensitive',
          }
        : undefined,
    };
  }

  private buildRegistryRecordOrderBy(
    sortBy: 'invoiceDate' | 'sellerName' | 'buyerName' | 'createdAt',
    sortOrder: 'asc' | 'desc',
  ): Prisma.RegistryRecordOrderByWithRelationInput {
    switch (sortBy) {
      case 'sellerName':
        return { sellerName: sortOrder };
      case 'buyerName':
        return { buyerName: sortOrder };
      case 'createdAt':
        return { createdAt: sortOrder };
      case 'invoiceDate':
      default:
        return { invoiceDate: sortOrder };
    }
  }

  private exactFilter(
    value: string | undefined,
  ): Prisma.StringFilter | undefined {
    const normalized = this.toOptionalString(value);

    return normalized ? { equals: normalized } : undefined;
  }

  private containsFilter(
    value: string | undefined,
  ): Prisma.StringFilter | undefined {
    const normalized = this.toOptionalString(value);

    return normalized
      ? {
          contains: normalized,
          mode: 'insensitive',
        }
      : undefined;
  }

  private buildInvoiceDateRange(
    from: string | undefined,
    to: string | undefined,
  ): Prisma.DateTimeFilter | undefined {
    const fromDate = this.toOptionalDate(from);
    const toDate = this.toOptionalDate(to);

    if (!fromDate && !toDate) {
      return undefined;
    }

    return {
      gte: fromDate ?? undefined,
      lte: toDate ?? undefined,
    };
  }

  private toRegistryRecordItemDto(
    item: RegistryRecordListItem,
  ): RegistryRecordItemDto {
    return {
      id: item.id,
      importId: item.importId,
      rowNumber: item.rowNumber,
      sellerRegionCode: item.sellerRegionCode,
      sellerDistrictCode: item.sellerDistrictCode,
      sellerIpn: item.sellerIpn,
      sellerName: item.sellerName,
      buyerRegionCode: item.buyerRegionCode,
      buyerDistrictCode: item.buyerDistrictCode,
      buyerIpn: item.buyerIpn,
      buyerName: item.buyerName,
      invoiceDate: item.invoiceDate,
      itemDescription: item.itemDescription,
      uktzedCode: item.uktzedCode,
      unitName: item.unitName,
      unitPriceActual: item.unitPriceActual?.toString() ?? null,
      createdAt: item.createdAt,
    };
  }

  private toRegistryImportItemDto(
    importRecord: RegistryImportRecord,
  ): RegistryImportItemDto {
    const sizeBytes = Number(importRecord.fileSizeBytes);

    return {
      id: importRecord.id,
      fileName: importRecord.originalFileName,
      fileType: this.resolveRegistryImportFileType(
        importRecord.originalFileName,
      ),
      status: this.toDtoStatus(importRecord.status),
      sizeBytes,
      sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(1)),
      fileSizeBytes: sizeBytes,
      fileSizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(1)),
      rowCount: importRecord.rowCount,
      errorMessage: importRecord.errorMessage,
      createdAt: importRecord.createdAt,
      startedAt: importRecord.startedAt,
      finishedAt: importRecord.finishedAt,
    };
  }

  private parseSpreadsheetRows(
    file: UploadedRegistryImportFile,
  ): ParsedWorkbook {
    const fileType = this.resolveRegistryImportFileType(file.originalname);

    if (fileType === RegistryImportFileType.CSV) {
      return this.parseCsvRows(file.buffer);
    }

    const workbook = read(file.buffer, {
      type: 'buffer',
      cellDates: false,
      dense: true,
    });
    const firstSheetName = workbook.SheetNames[0] ?? null;

    if (!firstSheetName) {
      return {
        firstSheetName: null,
        rows: [],
      };
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = utils.sheet_to_json<
      (string | number | boolean | Date | null)[]
    >(firstSheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    this.normalizeXlsxDateColumns(firstSheet, rows);

    return {
      firstSheetName,
      rows,
    };
  }

  private parseCsvRows(buffer: Buffer): ParsedWorkbook {
    const decodedCandidates = [
      buffer.toString('utf8').replace(/^\uFEFF/u, ''),
      new TextDecoder('windows-1251').decode(buffer).replace(/^\uFEFF/u, ''),
    ];
    const parsedCandidates = decodedCandidates.map((csvText) =>
      this.parseCsvRowsFromText(csvText),
    );

    return parsedCandidates.reduce((best, candidate) =>
      this.getHeaderMatchScore(candidate.rows) >
      this.getHeaderMatchScore(best.rows)
        ? candidate
        : best,
    );
  }

  private parseCsvRowsFromText(csvText: string): ParsedWorkbook {
    const delimiter = this.detectCsvDelimiter(csvText);
    const workbook = read(csvText, {
      type: 'string',
      dense: true,
      FS: delimiter,
      // Preserve CSV cells exactly as provided. Letting xlsx coerce values here
      // rewrites dd.mm.yyyy dates into locale-like m/d/yy strings.
      raw: true,
      codepage: 65001,
    });
    const firstSheetName = workbook.SheetNames[0] ?? null;

    if (!firstSheetName) {
      return {
        firstSheetName: null,
        rows: [],
      };
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = utils.sheet_to_json<
      (string | number | boolean | Date | null)[]
    >(firstSheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    return {
      firstSheetName,
      rows,
    };
  }

  private getHeaderMatchScore(
    rows: (string | number | boolean | Date | null)[][],
  ): number {
    const headerRow =
      rows[0]?.map((value) => this.normalizeCellValue(value)) ?? [];
    const headerCounts = new Map<string, number>();

    for (const header of headerRow) {
      if (!header) {
        continue;
      }

      headerCounts.set(header, (headerCounts.get(header) ?? 0) + 1);
    }

    let score = 0;

    for (const columnSpec of REGISTRY_IMPORT_COLUMN_SPECS) {
      const occurrences = headerCounts.get(columnSpec.header) ?? 0;

      if (occurrences >= columnSpec.occurrence) {
        score += 1;
      }
    }

    return score;
  }

  private normalizeXlsxDateColumns(
    sheet: unknown,
    rows: (string | number | boolean | Date | null)[][],
  ): void {
    if (rows.length === 0) {
      return;
    }

    const headerRow =
      rows[0]?.map((value) => this.normalizeCellValue(value)) ?? [];
    const dateColumnIndexes = headerRow.reduce<number[]>(
      (indexes, header, i) => {
        if (header === 'Дата виписки' || header === 'Дата реєстрації') {
          indexes.push(i);
        }

        return indexes;
      },
      [],
    );

    if (dateColumnIndexes.length === 0) {
      return;
    }

    rows.slice(1).forEach((row, rowOffset) => {
      const denseRow = this.getDenseWorksheetRow(sheet, rowOffset + 1);

      if (!denseRow) {
        return;
      }

      for (const columnIndex of dateColumnIndexes) {
        const normalizedDate = this.normalizeWorksheetDateCell(
          denseRow[columnIndex],
          row[columnIndex] ?? null,
        );

        if (normalizedDate) {
          row[columnIndex] = normalizedDate;
        }
      }
    });
  }

  private getDenseWorksheetRow(
    sheet: unknown,
    rowIndex: number,
  ): unknown[] | null {
    if (!Array.isArray(sheet)) {
      return null;
    }

    const row: unknown = sheet[rowIndex];

    return Array.isArray(row) ? row : null;
  }

  private normalizeWorksheetDateCell(
    cell: unknown,
    fallbackValue: string | number | boolean | Date | null,
  ): string | null {
    const denseCell = this.toDenseWorksheetCell(cell);

    if (denseCell && typeof denseCell.v === 'number') {
      const parsedDate = this.parseExcelSerialDate(denseCell.v);

      if (parsedDate) {
        return parsedDate;
      }
    }

    const displayedDate = denseCell?.w
      ? this.parseExcelDisplayedDate(denseCell.w)
      : null;

    if (displayedDate) {
      return displayedDate;
    }

    if (typeof fallbackValue === 'string') {
      return this.parseExcelDisplayedDate(fallbackValue) ?? fallbackValue;
    }

    return null;
  }

  private toDenseWorksheetCell(cell: unknown): DenseWorksheetCell | null {
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
      return null;
    }

    const { t, v, w } = cell as {
      t?: unknown;
      v?: unknown;
      w?: unknown;
    };

    return {
      t: typeof t === 'string' ? t : undefined,
      v,
      w: typeof w === 'string' ? w : undefined,
    };
  }

  private parseExcelSerialDate(serial: number): string | null {
    if (!Number.isFinite(serial)) {
      return null;
    }

    const wholeDays = Math.floor(serial);
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpochUtc + wholeDays * 24 * 60 * 60 * 1000);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return this.buildIsoDateString(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }

  private parseExcelDisplayedDate(value: string): string | null {
    const normalized = value.trim();
    const match =
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/u.exec(
        normalized,
      );

    if (!match) {
      return null;
    }

    const [, monthRaw, dayRaw, yearRaw] = match;
    const yearNumber = Number(yearRaw);
    const year =
      yearRaw.length === 2
        ? yearNumber >= 70
          ? 1900 + yearNumber
          : 2000 + yearNumber
        : yearNumber;

    return this.buildIsoDateString(year, Number(monthRaw), Number(dayRaw));
  }

  private buildIsoDateString(
    year: number,
    month: number,
    day: number,
  ): string | null {
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private detectCsvDelimiter(csvText: string): string {
    const firstNonEmptyLine =
      csvText
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? '';
    const candidates = [';', ',', '\t'] as const;
    let bestDelimiter = ';';
    let bestScore = -1;

    for (const candidate of candidates) {
      const score = firstNonEmptyLine.split(candidate).length;

      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = candidate;
      }
    }

    return bestDelimiter;
  }

  private resolveRegistryImportFileType(
    fileName: string,
  ): RegistryImportFileType {
    return fileName.toLowerCase().endsWith('.csv')
      ? RegistryImportFileType.CSV
      : RegistryImportFileType.XLSX;
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
