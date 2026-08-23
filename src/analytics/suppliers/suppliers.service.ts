import { BadRequestException, Injectable } from '@nestjs/common';
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
import type {
  SuppliersAnalyticsComparisonMode,
  SuppliersAnalyticsTimeGrain,
} from './types/suppliers.types';

type SuppliersExportFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

type ResolvedDateRange = {
  from: Date;
  to: Date;
};

type ResolvedSuppliersContext = {
  currentRange: ResolvedDateRange;
  comparisonMode: SuppliersAnalyticsComparisonMode;
  comparisonRange: ResolvedDateRange | null;
  timeGrain: SuppliersAnalyticsTimeGrain;
};

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  getSuppliers(
    user: AuthenticatedUser,
    query: SuppliersQueryDto,
  ): Promise<SuppliersResponseDto> {
    const scope = this.suppliersRepository.createBaseScope(user.userId, query);
    const resolved = this.resolveSuppliersContext(query);

    if (!this.suppliersRepository.hasSelectedSuppliers(scope)) {
      return Promise.resolve(this.buildEmptyDashboardResponse(query, resolved));
    }

    const comparisonScope = resolved.comparisonRange
      ? {
          ...scope,
          dateRange: resolved.comparisonRange,
        }
      : null;

    return Promise.all([
      this.suppliersRepository.getKpiTotals(scope),
      comparisonScope
        ? this.suppliersRepository.getKpiTotals(comparisonScope)
        : Promise.resolve(null),
      this.suppliersRepository.getTrendPoints(scope, resolved.timeGrain),
      comparisonScope
        ? this.suppliersRepository.getTrendPoints(
            comparisonScope,
            resolved.timeGrain,
          )
        : Promise.resolve([]),
    ]).then(([currentKpi, previousKpi, currentTrend, comparisonTrend]) => ({
      period: this.toPeriod(resolved),
      comparison: this.toComparison(resolved),
      kpi: this.buildKpi(currentKpi, previousKpi),
      trend: this.buildTrend(currentTrend, comparisonTrend, resolved.timeGrain),
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
    }));
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
    resolved: ResolvedSuppliersContext,
  ): SuppliersResponseDto {
    return {
      period: this.toPeriod(resolved),
      comparison: this.toComparison(resolved),
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

  private buildKpi(
    current: {
      salesWithVat: number;
      activeBuyers: number;
      salesRegions: number;
      productPositions: number;
    },
    previous: {
      salesWithVat: number;
      activeBuyers: number;
      salesRegions: number;
      productPositions: number;
    } | null,
  ) {
    return {
      salesWithVat: this.buildMetric(
        current.salesWithVat,
        previous?.salesWithVat ?? null,
      ),
      activeBuyers: this.buildMetric(
        current.activeBuyers,
        previous?.activeBuyers ?? null,
      ),
      salesRegions: this.buildMetric(
        current.salesRegions,
        previous?.salesRegions ?? null,
      ),
      productPositions: this.buildMetric(
        current.productPositions,
        previous?.productPositions ?? null,
      ),
    };
  }

  private buildTrend(
    current: Array<{
      periodStart: Date;
      salesWithVat: number;
    }>,
    comparison: Array<{
      periodStart: Date;
      salesWithVat: number;
    }>,
    timeGrain: SuppliersAnalyticsTimeGrain,
  ) {
    return current.map((point, index) => {
      const comparisonPoint = comparison[index] ?? null;

      return {
        periodStart: this.formatDateOnly(point.periodStart),
        periodLabel: this.formatPeriodLabel(point.periodStart, timeGrain),
        salesWithVat: point.salesWithVat,
        purchasesWithVat: 0,
        comparisonSalesWithVat: comparisonPoint?.salesWithVat ?? null,
        comparisonPurchasesWithVat: null,
      };
    });
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

  private resolveSuppliersContext(
    query: Pick<
      SuppliersQueryDto | SuppliersExportQueryDto,
      | 'dateFrom'
      | 'dateTo'
      | 'comparisonMode'
      | 'compareDateFrom'
      | 'compareDateTo'
      | 'timeGrain'
    >,
  ): ResolvedSuppliersContext {
    const currentRange = this.resolveDateRange(query.dateFrom, query.dateTo);
    const comparisonMode = query.comparisonMode ?? 'NONE';
    const comparisonRange = this.resolveComparisonRange(currentRange, {
      comparisonMode,
      compareDateFrom: query.compareDateFrom,
      compareDateTo: query.compareDateTo,
    });
    const timeGrain = this.resolveTimeGrain(currentRange, query.timeGrain);

    return {
      currentRange,
      comparisonMode,
      comparisonRange,
      timeGrain,
    };
  }

  private resolveDateRange(
    dateFrom: string,
    dateTo: string,
  ): ResolvedDateRange {
    const from = this.parseDateOnly(dateFrom);
    const to = this.parseDateOnly(dateTo);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException(
        'dateFrom must be before or equal to dateTo.',
      );
    }

    return { from, to };
  }

  private resolveComparisonRange(
    currentRange: ResolvedDateRange,
    options: {
      comparisonMode: SuppliersAnalyticsComparisonMode;
      compareDateFrom?: string;
      compareDateTo?: string;
    },
  ): ResolvedDateRange | null {
    switch (options.comparisonMode) {
      case 'NONE':
        return null;
      case 'PREVIOUS_PERIOD':
        return this.resolvePreviousPeriod(currentRange);
      case 'CUSTOM':
        if (!options.compareDateFrom || !options.compareDateTo) {
          throw new BadRequestException(
            'compareDateFrom and compareDateTo are required for CUSTOM comparison mode.',
          );
        }

        return this.resolveDateRange(
          options.compareDateFrom,
          options.compareDateTo,
        );
    }
  }

  private resolvePreviousPeriod(
    currentRange: ResolvedDateRange,
  ): ResolvedDateRange {
    const periodLengthInDays = this.getInclusiveDayCount(currentRange);
    const previousPeriodEnd = this.shiftDate(currentRange.from, -1);
    const previousPeriodStart = this.shiftDate(
      previousPeriodEnd,
      -(periodLengthInDays - 1),
    );

    return {
      from: previousPeriodStart,
      to: previousPeriodEnd,
    };
  }

  private resolveTimeGrain(
    currentRange: ResolvedDateRange,
    requestedTimeGrain?: SuppliersAnalyticsTimeGrain,
  ): SuppliersAnalyticsTimeGrain {
    if (requestedTimeGrain) {
      return requestedTimeGrain;
    }

    const days = this.getInclusiveDayCount(currentRange);

    if (days <= 730) {
      return 'MONTH';
    }

    if (days <= 3650) {
      return 'QUARTER';
    }

    return 'YEAR';
  }

  private buildMetric(current: number, previous: number | null) {
    return {
      current,
      previous,
      deltaPercent:
        previous === null
          ? null
          : this.calculateDeltaPercent(current, previous),
      hasComparablePrevious: previous !== null && previous !== 0,
    };
  }

  private calculateDeltaPercent(current: number, previous: number) {
    if (previous === 0) {
      return null;
    }

    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  private getInclusiveDayCount(range: ResolvedDateRange): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return (
      Math.floor(
        (range.to.getTime() - range.from.getTime()) / millisecondsPerDay,
      ) + 1
    );
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private shiftDate(value: Date, days: number): Date {
    const shifted = new Date(value);
    shifted.setUTCDate(shifted.getUTCDate() + days);

    return shifted;
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatPeriodLabel(
    value: Date,
    timeGrain: SuppliersAnalyticsTimeGrain,
  ): string {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;

    switch (timeGrain) {
      case 'MONTH':
        return `${year}-${String(month).padStart(2, '0')}`;
      case 'QUARTER':
        return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
      case 'YEAR':
        return String(year);
    }
  }

  private toPeriod(resolved: ResolvedSuppliersContext) {
    return {
      dateFrom: this.formatDateOnly(resolved.currentRange.from),
      dateTo: this.formatDateOnly(resolved.currentRange.to),
      timeGrain: resolved.timeGrain,
    };
  }

  private toComparison(resolved: ResolvedSuppliersContext) {
    return {
      mode: resolved.comparisonMode,
      dateFrom: resolved.comparisonRange
        ? this.formatDateOnly(resolved.comparisonRange.from)
        : null,
      dateTo: resolved.comparisonRange
        ? this.formatDateOnly(resolved.comparisonRange.to)
        : null,
    };
  }
}
