import { BadRequestException, Injectable } from '@nestjs/common';
import { utils, write } from 'xlsx';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ANALYTICS_UNKNOWN_REGION_NAME } from '../overview/constants/overview.constants';
import {
  BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  BUYERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  BUYERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  BUYERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  BUYERS_ANALYTICS_DEFAULT_TABLE_PAGE,
  BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION,
  BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD,
  BUYERS_ANALYTICS_EXPORT_FORMATS,
} from './constants/buyers.constants';
import { BuyersExportQueryDto } from './dto/buyers-export-query.dto';
import { BuyersFilterOptionsQueryDto } from './dto/buyers-filter-options-query.dto';
import { BuyersFilterOptionsResponseDto } from './dto/buyers-filter-options-response.dto';
import { BuyersQueryDto } from './dto/buyers-query.dto';
import { BuyersRankingsQueryDto } from './dto/buyers-rankings-query.dto';
import { BuyersRankingsResponseDto } from './dto/buyers-rankings-response.dto';
import { BuyersResponseDto } from './dto/buyers-response.dto';
import { BuyersTableQueryDto } from './dto/buyers-table-query.dto';
import { BuyersTableResponseDto } from './dto/buyers-table-response.dto';
import { BuyersRepository } from './buyers.repository';
import type {
  BuyersAnalyticsComparisonMode,
  BuyersAnalyticsTimeGrain,
} from './types/buyers.types';

type BuyersExportFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

type ResolvedDateRange = {
  from: Date;
  to: Date;
};

type ResolvedBuyersContext = {
  currentRange: ResolvedDateRange;
  comparisonMode: BuyersAnalyticsComparisonMode;
  comparisonRange: ResolvedDateRange | null;
  timeGrain: BuyersAnalyticsTimeGrain;
};

@Injectable()
export class BuyersService {
  constructor(private readonly buyersRepository: BuyersRepository) {}

  getBuyers(
    user: AuthenticatedUser,
    query: BuyersQueryDto,
  ): Promise<BuyersResponseDto> {
    const scope = this.buyersRepository.createBaseScope(user.userId, query);
    const resolved = this.resolveBuyersContext(query);

    if (!this.buyersRepository.hasSelectedBuyers(scope)) {
      return Promise.resolve(this.buildEmptyDashboardResponse(query, resolved));
    }

    const comparisonScope = resolved.comparisonRange
      ? {
          ...scope,
          dateRange: resolved.comparisonRange,
        }
      : null;

    return Promise.all([
      this.buyersRepository.getKpiTotals(scope),
      comparisonScope
        ? this.buyersRepository.getKpiTotals(comparisonScope)
        : Promise.resolve(null),
      this.buyersRepository.getTrendPoints(scope, resolved.timeGrain),
      this.buyersRepository.getMarketStructure(scope),
      this.buyersRepository.getTopSuppliers(scope),
      this.buyersRepository.getTopProducts(scope),
      this.buyersRepository.getTopSupplierRegions(scope),
      comparisonScope
        ? this.buyersRepository.getTrendPoints(
            comparisonScope,
            resolved.timeGrain,
          )
        : Promise.resolve([]),
      comparisonScope
        ? this.buyersRepository.getTopSuppliers(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.buyersRepository.getTopProducts(comparisonScope)
        : Promise.resolve([]),
      comparisonScope
        ? this.buyersRepository.getTopSupplierRegions(comparisonScope)
        : Promise.resolve([]),
    ]).then(
      ([
        currentKpi,
        previousKpi,
        currentTrend,
        marketStructure,
        topSuppliers,
        topProducts,
        topSupplierRegions,
        comparisonTrend,
        previousTopSuppliers,
        previousTopProducts,
        previousTopSupplierRegions,
      ]) => ({
        period: this.toPeriod(resolved),
        comparison: this.toComparison(resolved),
        kpi: this.buildKpi(currentKpi, previousKpi),
        trend: this.buildTrend(
          currentTrend,
          comparisonTrend,
          resolved.timeGrain,
        ),
        marketStructure: {
          ...marketStructure,
          top5ProductsShare: this.sumTopShares(topProducts),
          top5SupplierRegionsShare: this.sumTopShares(topSupplierRegions),
        },
        topSuppliers: this.buildTopEntities(topSuppliers, previousTopSuppliers),
        topProducts: this.buildTopProducts(topProducts, previousTopProducts),
        topSupplierRegions: this.buildTopRegions(
          topSupplierRegions,
          previousTopSupplierRegions,
        ),
        insights: this.buildInsights({
          kpi: this.buildKpi(currentKpi, previousKpi),
          trend: this.buildTrend(
            currentTrend,
            comparisonTrend,
            resolved.timeGrain,
          ),
          marketStructure: {
            ...marketStructure,
            top5ProductsShare: this.sumTopShares(topProducts),
            top5SupplierRegionsShare: this.sumTopShares(topSupplierRegions),
          },
          topSupplierRegions: this.buildTopRegions(
            topSupplierRegions,
            previousTopSupplierRegions,
          ),
        }),
      }),
    );
  }

  getBuyersTable(
    user: AuthenticatedUser,
    query: BuyersTableQueryDto,
  ): Promise<BuyersTableResponseDto> {
    const scope = this.buyersRepository.createBaseScope(user.userId, query);
    const resolved = this.resolveBuyersContext(query);
    const page = query.page ?? BUYERS_ANALYTICS_DEFAULT_TABLE_PAGE;
    const limit = query.limit ?? BUYERS_ANALYTICS_DEFAULT_TABLE_LIMIT;
    const sortBy = query.sortBy ?? BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD;
    const sortDirection =
      query.sortDirection ?? BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION;

    if (!this.buyersRepository.hasSelectedBuyers(scope)) {
      return Promise.resolve({
        items: [],
        total: 0,
        page,
        limit,
      });
    }

    return this.buyersRepository
      .getBuyersTable(scope, {
        timeGrain: resolved.timeGrain,
        page,
        limit,
        sortBy,
        sortDirection,
      })
      .then((result) => ({
        items: result.items.map((item) => ({
          period: this.formatTablePeriod(item.periodStart, resolved.timeGrain),
          supplierRegionCode: item.supplierRegionCode,
          supplierRegionName: this.buyersRepository.resolveRegionName(
            item.supplierRegionCode,
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
          purchasesWithVat: item.purchasesWithVat,
        })),
        total: result.total,
        page,
        limit,
      }));
  }

  async getBuyersRankings(
    user: AuthenticatedUser,
    query: BuyersRankingsQueryDto,
  ): Promise<BuyersRankingsResponseDto> {
    const scope = this.buyersRepository.createBaseScope(user.userId, query);
    const resolved = this.resolveBuyersContext(query);
    const comparisonScope = resolved.comparisonRange
      ? {
          ...scope,
          dateRange: resolved.comparisonRange,
        }
      : null;
    const page = query.page ?? BUYERS_ANALYTICS_DEFAULT_RANKINGS_PAGE;
    const limit = query.limit ?? BUYERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT;

    if (!this.buyersRepository.hasSelectedBuyers(scope)) {
      return {
        items: [],
        total: 0,
        page,
        limit,
      };
    }

    switch (query.dimension) {
      case 'suppliers': {
        const current = await this.buyersRepository.getSupplierRankings(scope, {
          page,
          limit,
        });
        const previous = comparisonScope
          ? await this.buyersRepository.getSupplierRankingComparisonAmounts(
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
      case 'products': {
        const current = await this.buyersRepository.getProductRankings(scope, {
          page,
          limit,
        });
        const previous = comparisonScope
          ? await this.buyersRepository.getProductRankingComparisonAmounts(
              comparisonScope,
              current.items.flatMap((item) =>
                item.name === null
                  ? []
                  : [
                      {
                        name: item.name,
                        uktzed: item.uktzed,
                      },
                    ],
              ),
            )
          : [];

        return {
          items: this.buildTopProducts(current.items, previous),
          total: current.total,
          page,
          limit,
        };
      }
      case 'regions': {
        const current = await this.buyersRepository.getSupplierRegionRankings(
          scope,
          {
            page,
            limit,
          },
        );
        const previous = comparisonScope
          ? await this.buyersRepository.getSupplierRegionRankingComparisonAmounts(
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

  getFilterOptions(
    user: AuthenticatedUser,
    query: BuyersFilterOptionsQueryDto,
  ): Promise<BuyersFilterOptionsResponseDto> {
    const scope = this.buyersRepository.createBaseScope(user.userId, query);
    const page = query.page ?? BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE;
    const limit = query.limit ?? BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT;

    if (
      query.dimension !== 'buyers' &&
      !this.buyersRepository.hasSelectedBuyers(scope)
    ) {
      return Promise.resolve({
        dimension: query.dimension,
        items: [],
        total: 0,
        page,
        limit,
      });
    }

    return this.buyersRepository
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

  exportBuyers(
    user: AuthenticatedUser,
    query: BuyersExportQueryDto,
  ): Promise<BuyersExportFile> {
    const scope = this.buyersRepository.createBaseScope(user.userId, query);
    const resolved = this.resolveBuyersContext(query);
    const format = this.resolveExportFormat(query.format);
    const fileName = `buyers-report-${query.dateFrom}-${query.dateTo}.${format}`;
    const sortBy = BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD;
    const sortDirection = BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION;

    if (!this.buyersRepository.hasSelectedBuyers(scope)) {
      return this.buildEmptyExportFile(fileName, format);
    }

    return this.buyersRepository
      .getBuyersTableExport(scope, {
        timeGrain: resolved.timeGrain,
        sortBy,
        sortDirection,
      })
      .then((items) => {
        const rows = items.map((item) => ({
          Period: this.formatTablePeriod(item.periodStart, resolved.timeGrain),
          'Supplier Region Code': item.supplierRegionCode,
          'Supplier Region Name': this.buyersRepository.resolveRegionName(
            item.supplierRegionCode,
          ),
          'Buyer Tax Number': item.buyerTaxNumber,
          'Buyer Name': item.buyerName,
          'Supplier Tax Number': item.supplierTaxNumber,
          Supplier: item.supplierName,
          Product: item.product,
          UKTZED: item.uktzed,
          Unit: item.unit,
          Quantity: item.quantity,
          'Price With VAT': item.priceWithVat,
          'Purchases With VAT': item.purchasesWithVat,
        }));

        if (format === 'xlsx') {
          const workbook = utils.book_new();
          const worksheet =
            rows.length > 0
              ? utils.json_to_sheet(rows)
              : utils.aoa_to_sheet([
                  [
                    'Period',
                    'Supplier Region Code',
                    'Supplier Region Name',
                    'Buyer Tax Number',
                    'Buyer Name',
                    'Supplier Tax Number',
                    'Supplier',
                    'Product',
                    'UKTZED',
                    'Unit',
                    'Quantity',
                    'Price With VAT',
                    'Purchases With VAT',
                  ],
                ]);
          utils.book_append_sheet(workbook, worksheet, 'Buyers');
          const workbookBuffer = write(workbook, {
            bookType: 'xlsx',
            type: 'buffer',
          }) as Buffer<ArrayBufferLike>;

          return {
            buffer: workbookBuffer,
            fileName,
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }

        const worksheet =
          rows.length > 0
            ? utils.json_to_sheet(rows)
            : utils.aoa_to_sheet([
                [
                  'Period',
                  'Supplier Region Code',
                  'Supplier Region Name',
                  'Buyer Tax Number',
                  'Buyer Name',
                  'Supplier Tax Number',
                  'Supplier',
                  'Product',
                  'UKTZED',
                  'Unit',
                  'Quantity',
                  'Price With VAT',
                  'Purchases With VAT',
                ],
              ]);

        return {
          buffer: Buffer.from(utils.sheet_to_csv(worksheet), 'utf-8'),
          fileName,
          mimeType: 'text/csv; charset=utf-8',
        };
      });
  }

  private resolveExportFormat(format?: string) {
    return BUYERS_ANALYTICS_EXPORT_FORMATS.includes(
      format as (typeof BUYERS_ANALYTICS_EXPORT_FORMATS)[number],
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
    query: BuyersQueryDto,
    resolved: ResolvedBuyersContext,
  ): BuyersResponseDto {
    return {
      period: this.toPeriod(resolved),
      comparison: this.toComparison(resolved),
      kpi: {
        purchasesWithVat: this.buildEmptyMetric(),
        activeSuppliers: this.buildEmptyMetric(),
        supplierRegions: this.buildEmptyMetric(),
        productPositions: this.buildEmptyMetric(),
      },
      trend: [],
      marketStructure: {
        topSupplier: null,
        topSupplierRegion: null,
        topUKTZED: null,
        top5SuppliersShare: null,
        top5ProductsShare: null,
        top5SupplierRegionsShare: null,
      },
      topSuppliers: [],
      topProducts: [],
      topSupplierRegions: [],
      insights: [],
    };
  }

  private buildKpi(
    current: {
      purchasesWithVat: number;
      activeSuppliers: number;
      supplierRegions: number;
      productPositions: number;
    },
    previous: {
      purchasesWithVat: number;
      activeSuppliers: number;
      supplierRegions: number;
      productPositions: number;
    } | null,
  ) {
    return {
      purchasesWithVat: this.buildMetric(
        current.purchasesWithVat,
        previous?.purchasesWithVat ?? null,
      ),
      activeSuppliers: this.buildMetric(
        current.activeSuppliers,
        previous?.activeSuppliers ?? null,
      ),
      supplierRegions: this.buildMetric(
        current.supplierRegions,
        previous?.supplierRegions ?? null,
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
      purchasesWithVat: number;
    }>,
    comparison: Array<{
      periodStart: Date;
      purchasesWithVat: number;
    }>,
    timeGrain: BuyersAnalyticsTimeGrain,
  ) {
    return current.map((point, index) => {
      const comparisonPoint = comparison[index] ?? null;

      return {
        periodStart: this.formatDateOnly(point.periodStart),
        periodLabel: this.formatPeriodLabel(point.periodStart, timeGrain),
        purchasesWithVat: point.purchasesWithVat,
        salesWithVat: 0,
        comparisonPurchasesWithVat: comparisonPoint?.purchasesWithVat ?? null,
        comparisonSalesWithVat: null,
      };
    });
  }

  private buildTopEntities(
    current: Array<{
      id: string | null;
      name: string | null;
      amount: number;
      share: number;
    }>,
    previous: Array<{
      id: string | null;
      name: string | null;
      amount: number;
      share: number;
    }>,
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
    current: Array<{
      productId: string | null;
      name: string | null;
      uktzed: string | null;
      amount: number;
      share: number;
    }>,
    previous: Array<{
      productId: string | null;
      name: string | null;
      uktzed: string | null;
      amount: number;
      share: number;
    }>,
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
    current: Array<{
      regionCode: string | null;
      regionName: string | null;
      amount: number;
      share: number;
      activeSuppliers: number;
    }>,
    previous: Array<{
      regionCode: string | null;
      regionName: string | null;
      amount: number;
      share: number;
      activeSuppliers: number;
    }>,
  ) {
    const previousByCode = new Map(
      previous.map((item) => [item.regionCode ?? '', item]),
    );

    return current.map((item) => {
      const previousItem = previousByCode.get(item.regionCode ?? '') ?? null;

      return {
        regionCode: item.regionCode,
        regionName: this.formatTopRegionName(item.regionName),
        amount: item.amount,
        share: item.share,
        activeSuppliers: item.activeSuppliers,
        previousAmount: previousItem?.amount ?? null,
        deltaPercent: this.calculateDeltaPercent(
          item.amount,
          previousItem?.amount ?? 0,
        ),
      };
    });
  }

  private buildInsights(input: {
    kpi: Record<
      string,
      {
        current: number;
        previous: number | null;
        deltaPercent: number | null;
        hasComparablePrevious: boolean;
      }
    >;
    trend: Array<{
      periodStart: string;
      periodLabel: string;
      salesWithVat: number;
      purchasesWithVat: number;
      comparisonSalesWithVat: number | null;
      comparisonPurchasesWithVat: number | null;
    }>;
    marketStructure: {
      topSupplier: {
        id: string | null;
        name: string | null;
        amount: number;
        share: number;
      } | null;
      topSupplierRegion: {
        regionCode: string | null;
        regionName: string | null;
        amount: number;
        share: number;
        activeSuppliers: number;
      } | null;
      topUKTZED: {
        code: string | null;
        name: string | null;
        description: string | null;
        amount: number;
        share: number;
      } | null;
      top5SuppliersShare: number | null;
      top5ProductsShare: number | null;
      top5SupplierRegionsShare: number | null;
    };
    topSupplierRegions: Array<{
      regionCode: string | null;
      regionName: string | null;
      amount: number;
      share: number;
      activeSuppliers: number;
      previousAmount: number | null;
      deltaPercent: number | null;
    }>;
  }) {
    const peakPurchasesPeriod = this.getPeakPurchasesPeriod(input.trend);
    const topRegion =
      input.marketStructure.topSupplierRegion ??
      input.topSupplierRegions[0] ??
      null;
    const topRegionDetails = topRegion
      ? (input.topSupplierRegions.find(
          (item) => item.regionCode === topRegion.regionCode,
        ) ?? null)
      : null;

    return [
      {
        type: 'PURCHASES_CHANGE',
        payload: {
          deltaPercent: input.kpi.purchasesWithVat.deltaPercent,
        },
      },
      {
        type: 'PEAK_PURCHASES_PERIOD',
        payload: {
          periodLabel: peakPurchasesPeriod?.periodLabel ?? null,
          amount: peakPurchasesPeriod?.amount ?? 0,
        },
      },
      {
        type: 'TOP_SUPPLIER_REGION',
        payload: {
          regionCode: topRegion?.regionCode ?? null,
          regionName: this.formatTopRegionName(topRegion?.regionName ?? null),
          amount: topRegion?.amount ?? 0,
          share: topRegion?.share ?? 0,
          activeSuppliers: topRegionDetails?.activeSuppliers ?? 0,
          previousAmount: topRegionDetails?.previousAmount ?? null,
          deltaPercent: topRegionDetails?.deltaPercent ?? null,
        },
      },
    ];
  }

  private getPeakPurchasesPeriod(
    trend: Array<{
      periodStart: string;
      periodLabel: string;
      salesWithVat: number;
      purchasesWithVat: number;
      comparisonSalesWithVat: number | null;
      comparisonPurchasesWithVat: number | null;
    }>,
  ): {
    periodLabel: string;
    amount: number;
  } | null {
    if (trend.length === 0) {
      return null;
    }

    const peak = trend.reduce((best, item) =>
      item.purchasesWithVat > best.purchasesWithVat ? item : best,
    );

    return {
      periodLabel: peak.periodLabel,
      amount: peak.purchasesWithVat,
    };
  }

  private sumTopShares(
    items: Array<{
      share: number;
    }>,
  ): number {
    return items.reduce((total, item) => total + item.share, 0);
  }

  private formatTopRegionName(regionName: string | null): string | null {
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

  private buildEmptyExportFile(
    fileName: string,
    format: 'csv' | 'xlsx',
  ): Promise<BuyersExportFile> {
    if (format === 'xlsx') {
      const workbook = utils.book_new();
      const worksheet = utils.aoa_to_sheet([
        [
          'Period',
          'Supplier Region Code',
          'Supplier Region Name',
          'Buyer Tax Number',
          'Buyer Name',
          'Supplier Tax Number',
          'Supplier',
          'Product',
          'UKTZED',
          'Unit',
          'Quantity',
          'Price With VAT',
          'Purchases With VAT',
        ],
      ]);
      utils.book_append_sheet(workbook, worksheet, 'Buyers');
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
        'Period,Supplier Region Code,Supplier Region Name,Buyer Tax Number,Buyer Name,Supplier Tax Number,Supplier,Product,UKTZED,Unit,Quantity,Price With VAT,Purchases With VAT\n',
      ),
      fileName,
      mimeType: 'text/csv',
    });
  }

  private resolveBuyersContext(
    query: Pick<
      BuyersQueryDto | BuyersExportQueryDto,
      | 'dateFrom'
      | 'dateTo'
      | 'comparisonMode'
      | 'compareDateFrom'
      | 'compareDateTo'
      | 'timeGrain'
    >,
  ): ResolvedBuyersContext {
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
      comparisonMode: BuyersAnalyticsComparisonMode;
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
    requestedTimeGrain?: BuyersAnalyticsTimeGrain,
  ): BuyersAnalyticsTimeGrain {
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
    timeGrain: BuyersAnalyticsTimeGrain,
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
    timeGrain: BuyersAnalyticsTimeGrain,
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

  private toPeriod(resolved: ResolvedBuyersContext) {
    return {
      dateFrom: this.formatDateOnly(resolved.currentRange.from),
      dateTo: this.formatDateOnly(resolved.currentRange.to),
      timeGrain: resolved.timeGrain,
    };
  }

  private toComparison(resolved: ResolvedBuyersContext) {
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
