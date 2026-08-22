import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  ANALYTICS_DEFAULT_TABLE_LIMIT,
  ANALYTICS_DEFAULT_TABLE_PAGE,
} from './constants/overview.constants';
import { FilterOptionsQueryDto } from './dto/filter-options-query.dto';
import { FilterOptionsResponseDto } from './dto/filter-options-response.dto';
import { OverviewExportQueryDto } from './dto/overview-export-query.dto';
import { OverviewExportResponseDto } from './dto/overview-export-response.dto';
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
      comparisonScope
        ? this.overviewRepository.getTrendPoints(
            comparisonScope,
            resolved.timeGrain,
          )
        : Promise.resolve([]),
    ]).then(
      ([
        currentKpi,
        previousKpi,
        currentTrend,
        marketStructure,
        comparisonTrend,
      ]) => ({
        period: this.toPeriod(resolved),
        comparison: this.toComparison(resolved),
        kpi: this.buildKpi(currentKpi, previousKpi),
        trend: this.buildTrend(
          currentTrend,
          comparisonTrend,
          resolved.timeGrain,
        ),
        marketStructure,
        topBuyers: [],
        topSuppliers: [],
        topProducts: [],
        topRegions: [],
        insights: [],
      }),
    );
  }

  getOverviewTable(
    user: AuthenticatedUser,
    query: OverviewTableQueryDto,
  ): OverviewTableResponseDto {
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const where = this.overviewRepository.buildBaseWhere(scope);
    void where;

    return {
      items: [],
      total: 0,
      page: query.page ?? ANALYTICS_DEFAULT_TABLE_PAGE,
      limit: query.limit ?? ANALYTICS_DEFAULT_TABLE_LIMIT,
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

  getFilterOptions(
    user: AuthenticatedUser,
    query: FilterOptionsQueryDto,
  ): FilterOptionsResponseDto {
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const where = this.overviewRepository.buildBaseWhere(scope);
    void where;

    return {
      dimension: query.dimension,
      items: [],
      total: 0,
      page: query.page ?? ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
      limit: query.limit ?? ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
    };
  }

  exportOverview(
    user: AuthenticatedUser,
    query: OverviewExportQueryDto,
  ): OverviewExportResponseDto {
    this.resolveOverviewContext(query);
    const scope = this.overviewRepository.createBaseScope(user.userId, query);
    const where = this.overviewRepository.buildBaseWhere(scope);
    void where;

    return {
      format: query.format ?? 'csv',
      message: 'Overview export scaffold is ready.',
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

    if (days <= 31) {
      return 'DAY';
    }

    if (days <= 120) {
      return 'WEEK';
    }

    if (days <= 730) {
      return 'MONTH';
    }

    return 'QUARTER';
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
      case 'DAY':
        return this.formatDateOnly(value);
      case 'WEEK':
        return `Week of ${this.formatDateOnly(value)}`;
      case 'MONTH':
        return `${year}-${String(month).padStart(2, '0')}`;
      case 'QUARTER':
        return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
    }
  }
}
