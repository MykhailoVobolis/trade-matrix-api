import { BadRequestException, Injectable } from '@nestjs/common';
import { utils, write } from 'xlsx';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  ANALYTICS_DEFAULT_TABLE_LIMIT,
  ANALYTICS_DEFAULT_TABLE_PAGE,
  ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION,
  ANALYTICS_DEFAULT_TABLE_SORT_FIELD,
  ANALYTICS_UNKNOWN_REGION_NAME,
} from './constants/overview.constants';
import { FilterOptionsQueryDto } from './dto/filter-options-query.dto';
import { FilterOptionsResponseDto } from './dto/filter-options-response.dto';
import { OverviewExportQueryDto } from './dto/overview-export-query.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import {
  OverviewComparisonDto,
  OverviewMetricDto,
  OverviewPeriodDto,
  OverviewResponseDto,
} from './dto/overview-response.dto';
import { OverviewTableQueryDto } from './dto/overview-table-query.dto';
import { OverviewTableResponseDto } from './dto/overview-table-response.dto';
import { OverviewRepository } from './overview.repository';
import type {
  AnalyticsComparisonMode,
  AnalyticsMarketStructure,
  AnalyticsTimeGrain,
  AnalyticsTopEntity,
  AnalyticsTopProduct,
  AnalyticsTopRegion,
  AnalyticsTrendPoint,
} from './types/overview.types';

type ResolvedDateRange = {
  from: Date;
  to: Date;
};

type ResolvedOverviewContext = {
  currentRange: ResolvedDateRange;
  comparisonMode: AnalyticsComparisonMode;
  comparisonRange: ResolvedDateRange | null;
  timeGrain: AnalyticsTimeGrain;
};

type OverviewExportFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

@Injectable()
export class OverviewService {
  constructor(private readonly overviewRepository: OverviewRepository) {}

  getOverview(
    user: AuthenticatedUser,
    query: OverviewQueryDto,
  ): Promise<OverviewResponseDto> {
    const resolved = this.resolveOverviewContext(query);
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const where = this.overviewRepository.buildBaseWhere(scope);
    void where;
    const comparisonScope = resolved.comparisonRange
      ? {
          ...scope,
          dateRange: resolved.comparisonRange,
        }
      : null;

    return Promise.all([
      this.overviewRepository.getKpiTotals(scope),
      comparisonScope
        ? this.overviewRepository.getKpiTotals(comparisonScope)
        : Promise.resolve(null),
      this.overviewRepository.getTrendPoints(scope, resolved.timeGrain),
      this.overviewRepository.getMarketStructure(scope),
      this.overviewRepository.getTopBuyers(scope),
      this.overviewRepository.getTopSuppliers(scope),
      this.overviewRepository.getTopProducts(scope),
      this.overviewRepository.getTopRegions(scope),
      comparisonScope
        ? this.overviewRepository.getTrendPoints(
            comparisonScope,
            resolved.timeGrain,
          )
        : Promise.resolve([]),
      comparisonScope
        ? this.overviewRepository.getTopBuyers(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.overviewRepository.getTopSuppliers(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.overviewRepository.getTopProducts(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.overviewRepository.getTopRegions(comparisonScope)
        : Promise.resolve([]),
    ]).then(
      ([
        currentKpi,
        previousKpi,
        currentTrend,
        marketStructure,
        topBuyers,
        topSuppliers,
        topProducts,
        topRegions,
        comparisonTrend,
        previousTopBuyers,
        previousTopSuppliers,
        previousTopProducts,
        previousTopRegions,
      ]) => {
        const normalizedMarketStructure =
          this.buildMarketStructure(marketStructure);
        const normalizedTopRegions = this.buildTopRegions(
          topRegions,
          previousTopRegions,
        );
        const kpi = this.buildKpi(currentKpi, previousKpi);
        const trend = this.buildTrend(
          currentTrend,
          comparisonTrend,
          resolved.timeGrain,
        );

        return {
          period: this.toPeriod(resolved),
          comparison: this.toComparison(resolved),
          kpi,
          trend,
          marketStructure: normalizedMarketStructure,
          topBuyers: this.buildTopEntities(topBuyers, previousTopBuyers),
          topSuppliers: this.buildTopEntities(
            topSuppliers,
            previousTopSuppliers,
          ),
          topProducts: this.buildTopProducts(topProducts, previousTopProducts),
          topRegions: normalizedTopRegions,
          insights: this.buildInsights({
            kpi,
            trend,
            marketStructure: normalizedMarketStructure,
            topRegions: normalizedTopRegions,
          }),
        };
      },
    );
  }

  async getOverviewTable(
    user: AuthenticatedUser,
    query: OverviewTableQueryDto,
  ): Promise<OverviewTableResponseDto> {
    const resolved = this.resolveOverviewContext(query);
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const page = query.page ?? ANALYTICS_DEFAULT_TABLE_PAGE;
    const limit = query.limit ?? ANALYTICS_DEFAULT_TABLE_LIMIT;
    const sortBy = query.sortBy ?? ANALYTICS_DEFAULT_TABLE_SORT_FIELD;
    const sortDirection =
      query.sortDirection ?? ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION;
    const result = await this.overviewRepository.getOverviewTable(scope, {
      timeGrain: resolved.timeGrain,
      page,
      limit,
      sortBy,
      sortDirection,
    });

    return {
      items: result.items.map((item) => ({
        period: this.formatTablePeriod(item.periodStart, resolved.timeGrain),
        buyerRegionCode: item.buyerRegionCode,
        buyerRegionName: this.overviewRepository.resolveRegionName(
          item.buyerRegionCode,
        ),
        buyerTaxNumber: item.buyerTaxNumber,
        buyerName: item.buyerName,
        supplierTaxNumber: item.supplierTaxNumber,
        supplierName: item.supplierName,
        product: item.product,
        uktzed: item.uktzed,
        unit: item.unit,
        quantity: item.quantity,
        priceWithVat: item.priceWithVat,
        salesWithVat: item.salesWithVat,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  private buildTrend(
    current: AnalyticsTrendPoint[],
    comparison: AnalyticsTrendPoint[],
    timeGrain: AnalyticsTimeGrain,
  ) {
    return current.map((point, index) => {
      const comparisonPoint = comparison[index] ?? null;

      return {
        periodStart: this.formatDateOnly(point.periodStart),
        periodLabel: this.formatPeriodLabel(point.periodStart, timeGrain),
        salesWithVat: point.salesWithVat,
        purchasesWithVat: point.purchasesWithVat,
        comparisonSalesWithVat: comparisonPoint?.salesWithVat ?? null,
        comparisonPurchasesWithVat: comparisonPoint?.purchasesWithVat ?? null,
      };
    });
  }

  private buildTopEntities(
    current: AnalyticsTopEntity[],
    previous: AnalyticsTopEntity[],
  ) {
    const previousById = new Map(
      previous.map((item) => [item.id ?? item.name ?? '', item]),
    );

    return current.map((item) => {
      const previousItem = previousById.get(item.id ?? item.name ?? '') ?? null;

      return {
        id: item.id,
        name: item.name,
        amount: item.amount,
        share: item.share,
        previousAmount: previousItem?.amount ?? null,
        deltaPercent: this.calculateDeltaPercent(
          item.amount,
          previousItem?.amount ?? 0,
        ),
      };
    });
  }

  private buildTopProducts(
    current: AnalyticsTopProduct[],
    previous: AnalyticsTopProduct[],
  ) {
    const previousByKey = new Map(
      previous.map((item) => [
        `${item.name ?? ''}::${item.uktzed ?? ''}`,
        item,
      ]),
    );

    return current.map((item) => {
      const key = `${item.name ?? ''}::${item.uktzed ?? ''}`;
      const previousItem = previousByKey.get(key) ?? null;

      return {
        productId: item.productId,
        name: item.name,
        uktzed: item.uktzed,
        amount: item.amount,
        share: item.share,
        previousAmount: previousItem?.amount ?? null,
        deltaPercent: this.calculateDeltaPercent(
          item.amount,
          previousItem?.amount ?? 0,
        ),
      };
    });
  }

  private buildTopRegions(
    current: AnalyticsTopRegion[],
    previous: AnalyticsTopRegion[],
  ) {
    const previousByCode = new Map(
      previous.map((item) => [item.regionCode ?? '', item]),
    );

    return current.map((item) => {
      const previousItem = previousByCode.get(item.regionCode ?? '') ?? null;

      return {
        regionCode: item.regionCode,
        regionName:
          item.regionName ??
          this.overviewRepository.resolveRegionName(item.regionCode),
        amount: item.amount,
        share: item.share,
        activeBuyers: item.activeBuyers,
        previousAmount: previousItem?.amount ?? null,
        deltaPercent: this.calculateDeltaPercent(
          item.amount,
          previousItem?.amount ?? 0,
        ),
      };
    });
  }

  private buildMarketStructure(
    marketStructure: AnalyticsMarketStructure,
  ): AnalyticsMarketStructure {
    return {
      ...marketStructure,
      topBuyerRegion: marketStructure.topBuyerRegion
        ? {
            ...marketStructure.topBuyerRegion,
            regionCode: this.overviewRepository.resolveRegionCode(
              marketStructure.topBuyerRegion.regionCode,
            ),
            regionName: this.formatTopRegionInsightName(
              marketStructure.topBuyerRegion.regionName ??
                this.overviewRepository.resolveRegionName(
                  marketStructure.topBuyerRegion.regionCode,
                ),
            ),
          }
        : null,
    };
  }

  private buildEmptyMarketStructure(): AnalyticsMarketStructure {
    return {
      topBuyer: null,
      topSupplier: null,
      topBuyerRegion: null,
      topUKTZED: null,
      top5BuyersShare: 0,
      top5SuppliersShare: 0,
    };
  }

  private buildInsights(input: {
    kpi: Record<string, OverviewMetricDto>;
    trend: Array<{
      periodStart: string;
      periodLabel: string;
      salesWithVat: number;
      purchasesWithVat: number;
      comparisonSalesWithVat: number | null;
      comparisonPurchasesWithVat: number | null;
    }>;
    marketStructure: AnalyticsMarketStructure;
    topRegions: Array<{
      regionCode: string | null;
      regionName: string | null;
      amount: number;
      share: number;
      activeBuyers: number;
      previousAmount: number | null;
      deltaPercent: number | null;
    }>;
  }) {
    const peakSalesPeriod = this.getPeakTrendPoint(
      input.trend,
      'salesWithVat',
      'comparisonSalesWithVat',
    );
    const peakPurchasesPeriod = this.getPeakTrendPoint(
      input.trend,
      'purchasesWithVat',
      'comparisonPurchasesWithVat',
    );
    const topRegion =
      input.marketStructure.topBuyerRegion ?? input.topRegions[0] ?? null;
    const topRegionDetails = topRegion
      ? (input.topRegions.find(
          (item) => item.regionCode === topRegion.regionCode,
        ) ?? null)
      : null;

    return [
      {
        type: 'SALES_CHANGE',
        payload: {
          current: input.kpi.salesWithVat.current,
          previous: input.kpi.salesWithVat.previous,
          deltaPercent: input.kpi.salesWithVat.deltaPercent,
          hasComparablePrevious: input.kpi.salesWithVat.hasComparablePrevious,
        },
      },
      {
        type: 'PURCHASES_CHANGE',
        payload: {
          current: input.kpi.purchasesWithVat.current,
          previous: input.kpi.purchasesWithVat.previous,
          deltaPercent: input.kpi.purchasesWithVat.deltaPercent,
          hasComparablePrevious:
            input.kpi.purchasesWithVat.hasComparablePrevious,
        },
      },
      {
        type: 'PEAK_SALES_PERIOD',
        payload: {
          periodStart: peakSalesPeriod?.periodStart ?? null,
          periodLabel: peakSalesPeriod?.periodLabel ?? null,
          amount: peakSalesPeriod?.currentAmount ?? 0,
          previousAmount: peakSalesPeriod?.previousAmount ?? null,
        },
      },
      {
        type: 'PEAK_PURCHASES_PERIOD',
        payload: {
          periodStart: peakPurchasesPeriod?.periodStart ?? null,
          periodLabel: peakPurchasesPeriod?.periodLabel ?? null,
          amount: peakPurchasesPeriod?.currentAmount ?? 0,
          previousAmount: peakPurchasesPeriod?.previousAmount ?? null,
        },
      },
      {
        type: 'TOP_REGION',
        payload: {
          regionCode: topRegion?.regionCode ?? null,
          regionName: this.formatTopRegionInsightName(
            topRegion?.regionName ?? null,
          ),
          amount: topRegion?.amount ?? 0,
          share: topRegion?.share ?? 0,
          activeBuyers: topRegionDetails?.activeBuyers ?? 0,
          previousAmount: topRegionDetails?.previousAmount ?? null,
          deltaPercent: topRegionDetails?.deltaPercent ?? null,
        },
      },
    ];
  }

  private formatTopRegionInsightName(regionName: string | null): string | null {
    if (!regionName) {
      return null;
    }

    if (
      regionName === 'м. Київ' ||
      regionName === ANALYTICS_UNKNOWN_REGION_NAME
    ) {
      return regionName;
    }

    if (regionName.endsWith(' обл.')) {
      return regionName;
    }

    return `${regionName} обл.`;
  }

  private getPeakTrendPoint(
    trend: Array<{
      periodStart: string;
      periodLabel: string;
      salesWithVat: number;
      purchasesWithVat: number;
      comparisonSalesWithVat: number | null;
      comparisonPurchasesWithVat: number | null;
    }>,
    currentKey: 'salesWithVat' | 'purchasesWithVat',
    previousKey: 'comparisonSalesWithVat' | 'comparisonPurchasesWithVat',
  ): {
    periodStart: string;
    periodLabel: string;
    currentAmount: number;
    previousAmount: number | null;
  } | null {
    if (trend.length === 0) {
      return null;
    }

    const peak = trend.reduce(
      (best, point) => {
        if (!best) {
          return point;
        }

        if (point[currentKey] > best[currentKey]) {
          return point;
        }

        if (point[currentKey] === best[currentKey]) {
          return point.periodStart < best.periodStart ? point : best;
        }

        return best;
      },
      null as (typeof trend)[number] | null,
    );

    if (!peak) {
      return null;
    }

    return {
      periodStart: peak.periodStart,
      periodLabel: peak.periodLabel,
      currentAmount: peak[currentKey],
      previousAmount: peak[previousKey],
    };
  }

  async getFilterOptions(
    user: AuthenticatedUser,
    query: FilterOptionsQueryDto,
  ): Promise<FilterOptionsResponseDto> {
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const page = query.page ?? ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE;
    const limit = query.limit ?? ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT;
    const result = await this.overviewRepository.getFilterOptions(
      scope,
      query.dimension,
      {
        search: query.search,
        page,
        limit,
      },
    );

    return {
      dimension: query.dimension,
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async exportOverview(
    user: AuthenticatedUser,
    query: OverviewExportQueryDto,
  ): Promise<OverviewExportFile> {
    const resolved = this.resolveOverviewContext(query);
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const format = query.format ?? 'csv';
    const sortBy = ANALYTICS_DEFAULT_TABLE_SORT_FIELD;
    const sortDirection = ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION;
    const items = await this.overviewRepository.getOverviewTableExport(scope, {
      timeGrain: resolved.timeGrain,
      sortBy,
      sortDirection,
    });
    const rows = items.map((item) => ({
      Period: this.formatTablePeriod(item.periodStart, resolved.timeGrain),
      'Buyer Region Code': item.buyerRegionCode,
      'Buyer Region Name': this.overviewRepository.resolveRegionName(
        item.buyerRegionCode,
      ),
      'Buyer Tax Number': item.buyerTaxNumber,
      'Buyer Name': item.buyerName,
      'Supplier Tax Number': item.supplierTaxNumber,
      'Supplier Name': item.supplierName,
      Product: item.product,
      UKTZED: item.uktzed,
      Unit: item.unit,
      Quantity: item.quantity,
      'Price With VAT': item.priceWithVat,
      'Sales With VAT': item.salesWithVat,
    }));
    const fileName = this.buildOverviewExportFileName(query, format);

    if (format === 'xlsx') {
      const workbook = utils.book_new();
      const worksheet = utils.json_to_sheet(rows);
      utils.book_append_sheet(workbook, worksheet, 'Overview');

      return {
        buffer: write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
        fileName,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    const worksheet = utils.json_to_sheet(rows);

    return {
      buffer: Buffer.from(utils.sheet_to_csv(worksheet), 'utf-8'),
      fileName,
      mimeType: 'text/csv; charset=utf-8',
    };
  }

  private toPeriod(resolved: ResolvedOverviewContext): OverviewPeriodDto {
    return {
      dateFrom: this.formatDateOnly(resolved.currentRange.from),
      dateTo: this.formatDateOnly(resolved.currentRange.to),
      timeGrain: resolved.timeGrain,
    };
  }

  private toComparison(
    resolved: ResolvedOverviewContext,
  ): OverviewComparisonDto {
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

  private buildKpi(
    current: {
      salesWithVat: number;
      purchasesWithVat: number;
      activeBuyers: number;
      activeSuppliers: number;
      salesRegions: number;
    },
    previous: {
      salesWithVat: number;
      purchasesWithVat: number;
      activeBuyers: number;
      activeSuppliers: number;
      salesRegions: number;
    } | null,
  ): Record<string, OverviewMetricDto> {
    const currentBalance = current.salesWithVat - current.purchasesWithVat;
    const previousBalance = previous
      ? previous.salesWithVat - previous.purchasesWithVat
      : null;

    return {
      salesWithVat: this.buildMetric(
        current.salesWithVat,
        previous?.salesWithVat ?? null,
      ),
      purchasesWithVat: this.buildMetric(
        current.purchasesWithVat,
        previous?.purchasesWithVat ?? null,
      ),
      balance: this.buildMetric(currentBalance, previousBalance),
      activeBuyers: this.buildMetric(
        current.activeBuyers,
        previous?.activeBuyers ?? null,
      ),
      activeSuppliers: this.buildMetric(
        current.activeSuppliers,
        previous?.activeSuppliers ?? null,
      ),
      salesRegions: this.buildMetric(
        current.salesRegions,
        previous?.salesRegions ?? null,
      ),
    };
  }

  private resolveOverviewContext(
    query: Pick<
      OverviewQueryDto | OverviewExportQueryDto,
      | 'dateFrom'
      | 'dateTo'
      | 'comparisonMode'
      | 'compareDateFrom'
      | 'compareDateTo'
      | 'timeGrain'
    >,
  ): ResolvedOverviewContext {
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
      comparisonMode: AnalyticsComparisonMode;
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
    requestedTimeGrain?: AnalyticsTimeGrain,
  ): AnalyticsTimeGrain {
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

  private buildMetric(
    current: number,
    previous: number | null,
  ): OverviewMetricDto {
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

  private calculateDeltaPercent(
    current: number,
    previous: number,
  ): number | null {
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
    timeGrain: AnalyticsTimeGrain,
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

  private formatTablePeriod(
    value: Date,
    timeGrain: AnalyticsTimeGrain,
  ): string {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;

    switch (timeGrain) {
      case 'MONTH':
        return `${year}-${String(month).padStart(2, '0')}`;
      case 'QUARTER':
        return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
      case 'YEAR':
        return String(year);
    }
  }

  private buildOverviewExportFileName(
    query: Pick<OverviewExportQueryDto, 'dateFrom' | 'dateTo'>,
    format: 'csv' | 'xlsx',
  ): string {
    return `overview-report-${query.dateFrom}-${query.dateTo}.${format}`;
  }
}
