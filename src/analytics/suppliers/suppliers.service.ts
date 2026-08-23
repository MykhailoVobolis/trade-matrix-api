import { Injectable } from '@nestjs/common';
import { utils, write } from 'xlsx';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE,
  SUPPLIERS_ANALYTICS_EXPORT_FORMATS,
} from './constants/suppliers.constants';
import { SuppliersExportQueryDto } from './dto/suppliers-export-query.dto';
import { SuppliersFilterOptionsQueryDto } from './dto/suppliers-filter-options-query.dto';
import { SuppliersFilterOptionsResponseDto } from './dto/suppliers-filter-options-response.dto';
import { SuppliersQueryDto } from './dto/suppliers-query.dto';
import { SuppliersResponseDto } from './dto/suppliers-response.dto';
import { SuppliersTableQueryDto } from './dto/suppliers-table-query.dto';
import { SuppliersTableResponseDto } from './dto/suppliers-table-response.dto';
import { SuppliersRepository } from './suppliers.repository';

type SuppliersExportFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  getSuppliers(
    user: AuthenticatedUser,
    query: SuppliersQueryDto,
  ): Promise<SuppliersResponseDto> {
    const scope = this.suppliersRepository.createBaseScope(user.userId, query);
    const timeGrain = query.timeGrain ?? 'MONTH';
    const comparisonMode = query.comparisonMode ?? 'NONE';

    if (!this.suppliersRepository.hasSelectedSuppliers(scope)) {
      return Promise.resolve(
        this.buildEmptyDashboardResponse(query, timeGrain, comparisonMode),
      );
    }

    return Promise.resolve({
      period: {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        timeGrain,
      },
      comparison: {
        mode: comparisonMode,
        dateFrom: query.compareDateFrom ?? null,
        dateTo: query.compareDateTo ?? null,
      },
      kpi: {
        salesWithVat: this.buildEmptyMetric(),
        activeBuyers: this.buildEmptyMetric(),
        salesRegions: this.buildEmptyMetric(),
        productPositions: this.buildEmptyMetric(),
      },
      trend: [],
      marketStructure: {
        topBuyer: null,
        topBuyerRegion: null,
        topUKTZED: null,
        top5BuyersShare: null,
      },
      topBuyers: [],
      topProducts: [],
      topRegions: [],
      insights: [],
    });
  }

  getSuppliersTable(
    user: AuthenticatedUser,
    query: SuppliersTableQueryDto,
  ): Promise<SuppliersTableResponseDto> {
    const scope = this.suppliersRepository.createBaseScope(user.userId, query);

    if (!this.suppliersRepository.hasSelectedSuppliers(scope)) {
      return Promise.resolve({
        items: [],
        total: 0,
        page: query.page ?? SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE,
        limit: query.limit ?? SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
      });
    }

    return Promise.resolve({
      items: [],
      total: 0,
      page: query.page ?? SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE,
      limit: query.limit ?? SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
    });
  }

  getFilterOptions(
    user: AuthenticatedUser,
    query: SuppliersFilterOptionsQueryDto,
  ): Promise<SuppliersFilterOptionsResponseDto> {
    const scope = this.suppliersRepository.createBaseScope(user.userId, query);
    const page = query.page ?? SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE;
    const limit =
      query.limit ?? SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT;

    if (
      query.dimension !== 'suppliers' &&
      !this.suppliersRepository.hasSelectedSuppliers(scope)
    ) {
      return Promise.resolve({
        dimension: query.dimension,
        items: [],
        total: 0,
        page,
        limit,
      });
    }

    return this.suppliersRepository
      .getFilterOptions(scope, query.dimension, {
        search: query.search,
        page,
        limit,
      })
      .then((result) => ({
        dimension: query.dimension,
        items: result.items,
        total: result.total,
        page,
        limit,
      }));
  }

  exportSuppliers(
    user: AuthenticatedUser,
    query: SuppliersExportQueryDto,
  ): Promise<SuppliersExportFile> {
    const scope = this.suppliersRepository.createBaseScope(user.userId, query);
    const format = this.resolveExportFormat(query.format);
    const fileName = `suppliers-report-${query.dateFrom}-${query.dateTo}.${format}`;

    if (!this.suppliersRepository.hasSelectedSuppliers(scope)) {
      return this.buildEmptyExportFile(fileName, format);
    }

    if (format === 'xlsx') {
      const workbook = utils.book_new();
      const worksheet = utils.json_to_sheet([]);
      utils.book_append_sheet(workbook, worksheet, 'Suppliers');
      const workbookBuffer = write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      }) as Buffer<ArrayBufferLike>;

      return Promise.resolve({
        buffer: workbookBuffer,
        fileName,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }

    return this.buildEmptyExportFile(fileName, format);
  }

  private resolveExportFormat(format?: string) {
    return SUPPLIERS_ANALYTICS_EXPORT_FORMATS.includes(
      format as (typeof SUPPLIERS_ANALYTICS_EXPORT_FORMATS)[number],
    )
      ? (format as 'csv' | 'xlsx')
      : 'csv';
  }

  private buildEmptyMetric() {
    return {
      current: 0,
      previous: null,
      deltaPercent: null,
      hasComparablePrevious: false,
    };
  }

  private buildEmptyDashboardResponse(
    query: SuppliersQueryDto,
    timeGrain: string,
    comparisonMode: string,
  ): SuppliersResponseDto {
    return {
      period: {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        timeGrain,
      },
      comparison: {
        mode: comparisonMode,
        dateFrom: query.compareDateFrom ?? null,
        dateTo: query.compareDateTo ?? null,
      },
      kpi: {
        salesWithVat: this.buildEmptyMetric(),
        activeBuyers: this.buildEmptyMetric(),
        salesRegions: this.buildEmptyMetric(),
        productPositions: this.buildEmptyMetric(),
      },
      trend: [],
      marketStructure: {
        topBuyer: null,
        topBuyerRegion: null,
        topUKTZED: null,
        top5BuyersShare: null,
      },
      topBuyers: [],
      topProducts: [],
      topRegions: [],
      insights: [],
    };
  }

  private buildEmptyExportFile(
    fileName: string,
    format: 'csv' | 'xlsx',
  ): Promise<SuppliersExportFile> {
    if (format === 'xlsx') {
      const workbook = utils.book_new();
      const worksheet = utils.json_to_sheet([]);
      utils.book_append_sheet(workbook, worksheet, 'Suppliers');
      const workbookBuffer = write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      }) as Buffer<ArrayBufferLike>;

      return Promise.resolve({
        buffer: workbookBuffer,
        fileName,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }

    return Promise.resolve({
      buffer: Buffer.from(
        'period,buyerRegionCode,buyerRegionName,buyerTaxNumber,buyerName,product,uktzed,unit,quantity,priceWithVat,salesWithVat,marketShare\n',
      ),
      fileName,
      mimeType: 'text/csv',
    });
  }
}
