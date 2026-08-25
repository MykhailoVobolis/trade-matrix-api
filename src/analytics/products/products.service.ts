import { BadRequestException, Injectable } from '@nestjs/common';
import { utils, write } from 'xlsx';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  PRODUCTS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  PRODUCTS_ANALYTICS_DEFAULT_TABLE_PAGE,
  PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION,
  PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD,
  PRODUCTS_ANALYTICS_EXPORT_FORMATS,
  PRODUCTS_ANALYTICS_UNKNOWN_REGION_NAME,
} from './constants/products.constants';
import { ProductsFilterOptionsQueryDto } from './dto/products-filter-options-query.dto';
import { ProductsFilterOptionsResponseDto } from './dto/products-filter-options-response.dto';
import { ProductsExportQueryDto } from './dto/products-export-query.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { ProductsRankingsQueryDto } from './dto/products-rankings-query.dto';
import { ProductsRankingsResponseDto } from './dto/products-rankings-response.dto';
import {
  ProductsComparisonDto,
  ProductsMetricDto,
  ProductsPeriodDto,
  ProductsResponseDto,
} from './dto/products-response.dto';
import { ProductsTableQueryDto } from './dto/products-table-query.dto';
import { ProductsTableResponseDto } from './dto/products-table-response.dto';
import { ProductsRepository } from './products.repository';
import type {
  ProductsAnalyticsComparisonMode,
  ProductsAnalyticsMarketStructure,
  ProductsAnalyticsTimeGrain,
  ProductsAnalyticsTopEntity,
  ProductsAnalyticsTopRegion,
  ProductsAnalyticsTrendPoint,
} from './types/products.types';

type ResolvedDateRange = {
  from: Date;
  to: Date;
};

type ResolvedProductsContext = {
  currentRange: ResolvedDateRange;
  comparisonMode: ProductsAnalyticsComparisonMode;
  comparisonRange: ResolvedDateRange | null;
  timeGrain: ProductsAnalyticsTimeGrain;
};

type ProductsExportFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  getProducts(
    user: AuthenticatedUser,
    query: ProductsQueryDto,
  ): Promise<ProductsResponseDto> {
    const resolved = this.resolveProductsContext(query);
    const scope = this.productsRepository.createBaseScope(user.userId, query);

    if (!this.productsRepository.hasSelectedPrimaryFilters(scope)) {
      return Promise.resolve(this.buildEmptyDashboardResponse(resolved));
    }

    const comparisonScope = resolved.comparisonRange
      ? {
          ...scope,
          dateRange: resolved.comparisonRange,
        }
      : null;

    return Promise.all([
      this.productsRepository.getKpiTotals(scope),
      comparisonScope
        ? this.productsRepository.getKpiTotals(comparisonScope)
        : Promise.resolve(null),
      this.productsRepository.getTrendPoints(scope, resolved.timeGrain),
      this.productsRepository.getMarketStructure(scope),
      this.productsRepository.getTopBuyers(scope),
      this.productsRepository.getTopSuppliers(scope),
      this.productsRepository.getTopRegions(scope),
      comparisonScope
        ? this.productsRepository.getTrendPoints(
            comparisonScope,
            resolved.timeGrain,
          )
        : Promise.resolve([]),
      comparisonScope
        ? this.productsRepository.getTopBuyers(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.productsRepository.getTopSuppliers(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.productsRepository.getTopRegions(comparisonScope)
        : Promise.resolve([]),
    ]).then(
      ([
        currentKpi,
        previousKpi,
        currentTrend,
        marketStructure,
        topBuyers,
        topSuppliers,
        topRegions,
        comparisonTrend,
        previousTopBuyers,
        previousTopSuppliers,
        previousTopRegions,
      ]) => {
        const normalizedTopRegions = this.buildTopRegions(
          topRegions,
          previousTopRegions,
        );
        const normalizedMarketStructure = this.buildMarketStructure(
          marketStructure,
          normalizedTopRegions,
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
          kpi: this.toProductsKpi(kpi),
          trend: this.toProductsTrend(trend),
          marketStructure: normalizedMarketStructure,
          topBuyers: this.buildTopEntities(topBuyers, previousTopBuyers),
          topSuppliers: this.buildTopEntities(
            topSuppliers,
            previousTopSuppliers,
          ),
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

  async getProductsTable(
    user: AuthenticatedUser,
    query: ProductsTableQueryDto,
  ): Promise<ProductsTableResponseDto> {
    const resolved = this.resolveProductsContext(query);
    const scope = this.productsRepository.createBaseScope(user.userId, query);
    const page = query.page ?? PRODUCTS_ANALYTICS_DEFAULT_TABLE_PAGE;
    const limit = query.limit ?? PRODUCTS_ANALYTICS_DEFAULT_TABLE_LIMIT;
    const sortBy = query.sortBy ?? PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD;
    const sortDirection =
      query.sortDirection ?? PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION;

    if (!this.productsRepository.hasSelectedPrimaryFilters(scope)) {
      return {
        items: [],
        total: 0,
        page,
        limit,
      };
    }

    const result = await this.productsRepository.getProductsTable(scope, {
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
        buyerRegionName: this.productsRepository.resolveRegionName(
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

  async getProductsRankings(
    user: AuthenticatedUser,
    query: ProductsRankingsQueryDto,
  ): Promise<ProductsRankingsResponseDto> {
    const resolved = this.resolveProductsContext(query);
    const scope = this.productsRepository.createBaseScope(user.userId, query);
    const comparisonScope = resolved.comparisonRange
      ? {
          ...scope,
          dateRange: resolved.comparisonRange,
        }
      : null;
    const page = query.page ?? PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_PAGE;
    const limit = query.limit ?? PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_LIMIT;

    if (!this.productsRepository.hasSelectedPrimaryFilters(scope)) {
      return {
        items: [],
        total: 0,
        page,
        limit,
      };
    }

    switch (query.dimension) {
      case 'buyers': {
        const current = await this.productsRepository.getBuyerRankings(scope, {
          page,
          limit,
        });
        const previous = comparisonScope
          ? await this.productsRepository.getBuyerRankingComparisonAmounts(
              comparisonScope,
              current.items.map((item) => item.id).filter(Boolean) as string[],
            )
          : [];

        return {
          items: this.buildTopEntities(current.items, previous),
          total: current.total,
          page,
          limit,
        };
      }
      case 'suppliers': {
        const current = await this.productsRepository.getSupplierRankings(
          scope,
          {
            page,
            limit,
          },
        );
        const previous = comparisonScope
          ? await this.productsRepository.getSupplierRankingComparisonAmounts(
              comparisonScope,
              current.items.map((item) => item.id).filter(Boolean) as string[],
            )
          : [];

        return {
          items: this.buildTopEntities(current.items, previous),
          total: current.total,
          page,
          limit,
        };
      }
      case 'regions': {
        const current = await this.productsRepository.getRegionRankings(scope, {
          page,
          limit,
        });
        const previous = comparisonScope
          ? await this.productsRepository.getRegionRankingComparisonAmounts(
              comparisonScope,
              current.items
                .map((item) => item.regionCode)
                .filter(Boolean) as string[],
            )
          : [];

        return {
          items: this.buildTopRegions(current.items, previous),
          total: current.total,
          page,
          limit,
        };
      }
    }
  }

  private buildTrend(
    current: ProductsAnalyticsTrendPoint[],
    comparison: ProductsAnalyticsTrendPoint[],
    timeGrain: ProductsAnalyticsTimeGrain,
  ) {
    return current.map((point, index) => {
      const comparisonPoint = comparison[index] ?? null;

      return {
        periodStart: this.formatDateOnly(point.periodStart),
        periodLabel: this.formatPeriodLabel(point.periodStart, timeGrain),
        salesWithVat: point.salesWithVat,
        comparisonSalesWithVat: comparisonPoint?.salesWithVat ?? null,
      };
    });
  }

  private toProductsKpi(kpi: Record<string, ProductsMetricDto>) {
    return {
      salesWithVat: kpi.salesWithVat,
      activeBuyers: kpi.activeBuyers,
      activeSuppliers: kpi.activeSuppliers,
      salesRegions: kpi.salesRegions,
    };
  }

  private toProductsTrend(
    trend: Array<{
      periodStart: string;
      periodLabel: string;
      salesWithVat: number;
      comparisonSalesWithVat: number | null;
    }>,
  ) {
    return trend.map((point) => ({
      periodStart: point.periodStart,
      periodLabel: point.periodLabel,
      salesWithVat: point.salesWithVat,
      comparisonSalesWithVat: point.comparisonSalesWithVat,
    }));
  }

  private buildTopEntities(
    current: ProductsAnalyticsTopEntity[],
    previous: ProductsAnalyticsTopEntity[],
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

  private buildTopRegions(
    current: ProductsAnalyticsTopRegion[],
    previous: ProductsAnalyticsTopRegion[],
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
          this.productsRepository.resolveRegionName(item.regionCode),
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
    marketStructure: ProductsAnalyticsMarketStructure,
    topRegions: Array<{
      regionCode: string | null;
      regionName: string | null;
      amount: number;
      share: number;
      activeBuyers: number;
      previousAmount: number | null;
      deltaPercent: number | null;
    }>,
  ): ProductsAnalyticsMarketStructure {
    const topBuyerRegionDetails = marketStructure.topBuyerRegion
      ? (topRegions.find(
          (item) =>
            item.regionCode === marketStructure.topBuyerRegion?.regionCode,
        ) ?? null)
      : null;

    return {
      ...marketStructure,
      topBuyerRegion: marketStructure.topBuyerRegion
        ? {
            ...marketStructure.topBuyerRegion,
            regionCode: this.productsRepository.resolveRegionCode(
              marketStructure.topBuyerRegion.regionCode,
            ),
            regionName: this.formatTopRegionInsightName(
              marketStructure.topBuyerRegion.regionName ??
                this.productsRepository.resolveRegionName(
                  marketStructure.topBuyerRegion.regionCode,
                ),
            ),
            activeBuyers: topBuyerRegionDetails?.activeBuyers ?? 0,
          }
        : null,
      top5RegionsShare: this.sumTopShares(topRegions),
    };
  }

  private buildEmptyMarketStructure(): ProductsAnalyticsMarketStructure {
    return {
      topBuyer: null,
      topSupplier: null,
      topBuyerRegion: null,
      top5BuyersShare: 0,
      top5SuppliersShare: 0,
      top5RegionsShare: 0,
    };
  }

  private buildInsights(input: {
    kpi: Record<string, ProductsMetricDto>;
    trend: Array<{
      periodStart: string;
      periodLabel: string;
      salesWithVat: number;
      comparisonSalesWithVat: number | null;
    }>;
    marketStructure: ProductsAnalyticsMarketStructure;
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
          deltaPercent: input.kpi.salesWithVat.deltaPercent,
        },
      },
      {
        type: 'PEAK_SALES_PERIOD',
        payload: {
          periodLabel: peakSalesPeriod?.periodLabel ?? null,
          amount: peakSalesPeriod?.currentAmount ?? 0,
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
      regionName === PRODUCTS_ANALYTICS_UNKNOWN_REGION_NAME
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
      comparisonSalesWithVat: number | null;
    }>,
    currentKey: 'salesWithVat',
    previousKey: 'comparisonSalesWithVat',
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
    query: ProductsFilterOptionsQueryDto,
  ): Promise<ProductsFilterOptionsResponseDto> {
    const scope = this.productsRepository.createBaseScope(user.userId, query);
    const page = query.page ?? PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE;
    const limit =
      query.limit ?? PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT;

    if (
      query.dimension !== 'products' &&
      query.dimension !== 'uktzed' &&
      !this.productsRepository.hasSelectedPrimaryFilters(scope)
    ) {
      return {
        dimension: query.dimension,
        items: [],
        total: 0,
        page,
        limit,
      };
    }

    const result = await this.productsRepository.getFilterOptions(
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

  async exportProducts(
    user: AuthenticatedUser,
    query: ProductsExportQueryDto,
  ): Promise<ProductsExportFile> {
    const resolved = this.resolveProductsContext(query);
    const scope = this.productsRepository.createBaseScope(user.userId, query);
    const format = this.resolveExportFormat(query.format);
    const sortBy = PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD;
    const sortDirection = PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION;
    const fileName = this.buildProductsExportFileName(query, format);

    if (!this.productsRepository.hasSelectedPrimaryFilters(scope)) {
      return this.buildEmptyExportFile(fileName, format);
    }

    const items = await this.productsRepository.getProductsTableExport(scope, {
      timeGrain: resolved.timeGrain,
      sortBy,
      sortDirection,
    });
    const rows = items.map((item) => ({
      Period: this.formatTablePeriod(item.periodStart, resolved.timeGrain),
      'Buyer Region Code': item.buyerRegionCode,
      'Buyer Region Name': this.productsRepository.resolveRegionName(
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

    if (format === 'xlsx') {
      const workbook = utils.book_new();
      const worksheet = utils.json_to_sheet(rows);
      utils.book_append_sheet(workbook, worksheet, 'Products');

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

  private resolveExportFormat(format?: string) {
    return PRODUCTS_ANALYTICS_EXPORT_FORMATS.includes(
      format as (typeof PRODUCTS_ANALYTICS_EXPORT_FORMATS)[number],
    )
      ? (format as 'csv' | 'xlsx')
      : 'csv';
  }

  private buildEmptyMetric(): ProductsMetricDto {
    return {
      current: 0,
      previous: null,
      deltaPercent: null,
      hasComparablePrevious: false,
    };
  }

  private buildEmptyDashboardResponse(
    resolved: ResolvedProductsContext,
  ): ProductsResponseDto {
    return {
      period: this.toPeriod(resolved),
      comparison: this.toComparison(resolved),
      kpi: {
        salesWithVat: this.buildEmptyMetric(),
        activeBuyers: this.buildEmptyMetric(),
        activeSuppliers: this.buildEmptyMetric(),
        salesRegions: this.buildEmptyMetric(),
      },
      trend: [],
      marketStructure: {
        topSupplier: null,
        topBuyer: null,
        topBuyerRegion: null,
        top5SuppliersShare: 0,
        top5BuyersShare: 0,
        top5RegionsShare: 0,
      },
      topBuyers: [],
      topSuppliers: [],
      topRegions: [],
      insights: [],
    };
  }

  private buildEmptyExportFile(
    fileName: string,
    format: 'csv' | 'xlsx',
  ): ProductsExportFile {
    const headers = [
      'Period',
      'Buyer Region Code',
      'Buyer Region Name',
      'Buyer Tax Number',
      'Buyer Name',
      'Supplier Tax Number',
      'Supplier Name',
      'Product',
      'UKTZED',
      'Unit',
      'Quantity',
      'Price With VAT',
      'Sales With VAT',
    ];

    if (format === 'xlsx') {
      const workbook = utils.book_new();
      const worksheet = utils.aoa_to_sheet([headers]);
      utils.book_append_sheet(workbook, worksheet, 'Products');

      return {
        buffer: write(workbook, {
          bookType: 'xlsx',
          type: 'buffer',
        }) as Buffer<ArrayBufferLike>,
        fileName,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    const worksheet = utils.aoa_to_sheet([headers]);

    return {
      buffer: Buffer.from(utils.sheet_to_csv(worksheet), 'utf-8'),
      fileName,
      mimeType: 'text/csv; charset=utf-8',
    };
  }

  private toPeriod(resolved: ResolvedProductsContext): ProductsPeriodDto {
    return {
      dateFrom: this.formatDateOnly(resolved.currentRange.from),
      dateTo: this.formatDateOnly(resolved.currentRange.to),
      timeGrain: resolved.timeGrain,
    };
  }

  private toComparison(
    resolved: ResolvedProductsContext,
  ): ProductsComparisonDto {
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
  ): Record<string, ProductsMetricDto> {
    return {
      salesWithVat: this.buildMetric(
        current.salesWithVat,
        previous?.salesWithVat ?? null,
      ),
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

  private sumTopShares(
    items: Array<{
      share: number;
    }>,
  ): number {
    return Number(
      items.reduce((total, item) => total + item.share, 0).toFixed(2),
    );
  }

  private resolveProductsContext(
    query: Pick<
      ProductsQueryDto | ProductsExportQueryDto,
      | 'dateFrom'
      | 'dateTo'
      | 'comparisonMode'
      | 'compareDateFrom'
      | 'compareDateTo'
      | 'timeGrain'
    >,
  ): ResolvedProductsContext {
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
      comparisonMode: ProductsAnalyticsComparisonMode;
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
    requestedTimeGrain?: ProductsAnalyticsTimeGrain,
  ): ProductsAnalyticsTimeGrain {
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
  ): ProductsMetricDto {
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
    timeGrain: ProductsAnalyticsTimeGrain,
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
    timeGrain: ProductsAnalyticsTimeGrain,
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

  private buildProductsExportFileName(
    query: Pick<ProductsExportQueryDto, 'dateFrom' | 'dateTo'>,
    format: 'csv' | 'xlsx',
  ): string {
    return `products-report-${query.dateFrom}-${query.dateTo}.${format}`;
  }
}
