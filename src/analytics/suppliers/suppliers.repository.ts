import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ANALYTICS_REGION_DICTIONARY,
  ANALYTICS_UNKNOWN_REGION_CODE,
  ANALYTICS_UNKNOWN_REGION_NAME,
} from '../overview/constants/overview.constants';
import type { SuppliersBaseQueryDto } from './dto/suppliers-base-query.dto';
import type {
  SuppliersAnalyticsBaseScope,
  SuppliersAnalyticsFilterOptionDimension,
  SuppliersAnalyticsKpiTotals,
  SuppliersAnalyticsMarketEntity,
  SuppliersAnalyticsMarketRegion,
  SuppliersAnalyticsMarketStructure,
  SuppliersAnalyticsMarketUktzed,
  SuppliersAnalyticsTableItem,
  SuppliersAnalyticsTableResult,
  SuppliersAnalyticsTimeGrain,
  SuppliersAnalyticsTableSortField,
  SuppliersAnalyticsTopEntity,
  SuppliersAnalyticsTopProduct,
  SuppliersAnalyticsTopRegion,
  SuppliersAnalyticsTrendPoint,
} from './types/suppliers.types';

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  createBaseScope(
    userId: string,
    query: SuppliersBaseQueryDto,
  ): SuppliersAnalyticsBaseScope {
    return {
      userId,
      dateRange: {
        from: this.toStartOfDayUtc(query.dateFrom),
        to: this.toEndOfDayUtc(query.dateTo),
      },
      filters: {
        supplierTaxNumbers: this.normalizeTaxNumbers(query.supplierTaxNumbers),
        buyerTaxNumbers: this.normalizeTaxNumbers(query.buyerTaxNumbers),
        buyerRegionCodes: this.normalizeRegionCodes(query.buyerRegionCodes),
        uktzedValues: this.normalizeUktzedValues(query.uktzed),
        products: this.normalizePreservedStringValues(query.products),
      },
    };
  }

  hasSelectedSuppliers(scope: SuppliersAnalyticsBaseScope): boolean {
    return scope.filters.supplierTaxNumbers.length > 0;
  }

  buildBaseWhere(
    scope: SuppliersAnalyticsBaseScope,
    options?: {
      includeSupplierFilter?: boolean;
    },
  ): Prisma.RegistryRecordWhereInput {
    const includeSupplierFilter = options?.includeSupplierFilter ?? true;
    const where: Prisma.RegistryRecordWhereInput = {
      userId: scope.userId,
      isCanonical: true,
      NOT: {
        isExcluded: true,
      },
      invoiceDate: {
        gte: scope.dateRange.from,
        lte: scope.dateRange.to,
      },
    };

    if (includeSupplierFilter && scope.filters.supplierTaxNumbers.length > 0) {
      where.sellerTaxNumber = {
        in: scope.filters.supplierTaxNumbers,
      };
    }

    if (scope.filters.buyerTaxNumbers.length > 0) {
      where.buyerTaxNumber = {
        in: scope.filters.buyerTaxNumbers,
      };
    }

    if (scope.filters.buyerRegionCodes.length > 0) {
      where.buyerRegionCode = {
        in: scope.filters.buyerRegionCodes,
      };
    }

    if (scope.filters.uktzedValues.length > 0) {
      where.OR = scope.filters.uktzedValues.map((value) => ({
        uktzedCode: value,
      }));
    }

    return where;
  }

  async getKpiTotals(
    scope: SuppliersAnalyticsBaseScope,
  ): Promise<SuppliersAnalyticsKpiTotals> {
    const amountWithVatSql = this.amountWithVatSql();
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const productIdentitySql = this.buildNormalizedProductSql();
    const whereSql = this.buildBaseScopeSql(scope);

    const [row] = await this.prisma.$queryRaw<
      Array<{
        salesWithVat: Prisma.Decimal | null;
        activeBuyers: bigint | number;
        salesRegions: bigint | number;
        productPositions: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN ${supplierIdentitySql} IS NOT NULL THEN ${amountWithVatSql}
              ELSE 0
            END
          ),
          0
        ) AS "salesWithVat",
        COUNT(
          DISTINCT CASE
            WHEN ${supplierIdentitySql} IS NOT NULL THEN ${buyerIdentitySql}
            ELSE NULL
          END
        ) AS "activeBuyers",
        COUNT(
          DISTINCT CASE
            WHEN ${supplierIdentitySql} IS NOT NULL
             AND record."buyer_region_code" IS NOT NULL
             AND BTRIM(record."buyer_region_code") <> ''
            THEN ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')}
            ELSE NULL
          END
        ) AS "salesRegions",
        COUNT(
          DISTINCT CASE
            WHEN ${supplierIdentitySql} IS NOT NULL THEN ${productIdentitySql}
            ELSE NULL
          END
        ) AS "productPositions"
      FROM "RegistryRecord" AS record
      WHERE ${whereSql}
    `);

    return {
      salesWithVat: Number(row?.salesWithVat ?? 0),
      activeBuyers: Number(row?.activeBuyers ?? 0),
      salesRegions: Number(row?.salesRegions ?? 0),
      productPositions: Number(row?.productPositions ?? 0),
    };
  }

  async getTrendPoints(
    scope: SuppliersAnalyticsBaseScope,
    timeGrain: SuppliersAnalyticsTimeGrain,
  ): Promise<SuppliersAnalyticsTrendPoint[]> {
    const amountWithVatSql = this.amountWithVatSql();
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const bucketExpressionSql = this.buildBucketExpressionSql(timeGrain);
    const generateSeriesStart = this.getBucketStartDate(
      scope.dateRange.from,
      timeGrain,
    );
    const generateSeriesEnd = this.getBucketStartDate(
      scope.dateRange.to,
      timeGrain,
    );
    const seriesStepSql = this.buildSeriesStepSql(timeGrain);
    const whereSql = this.buildBaseScopeSql(scope);

    const rows = await this.prisma.$queryRaw<
      Array<{
        periodStart: Date;
        salesWithVat: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH buckets AS (
        SELECT generate_series(
          ${generateSeriesStart}::timestamp,
          ${generateSeriesEnd}::timestamp,
          ${seriesStepSql}
        ) AS bucket_start
      ),
      aggregated AS (
        SELECT
          ${bucketExpressionSql} AS bucket_start,
          COALESCE(
            SUM(
              CASE
                WHEN ${supplierIdentitySql} IS NOT NULL THEN ${amountWithVatSql}
                ELSE 0
              END
            ),
            0
          ) AS sales_with_vat
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
        GROUP BY 1
      )
      SELECT
        buckets.bucket_start AS "periodStart",
        COALESCE(aggregated.sales_with_vat, 0) AS "salesWithVat"
      FROM buckets
      LEFT JOIN aggregated
        ON aggregated.bucket_start = buckets.bucket_start
      ORDER BY buckets.bucket_start ASC
    `);

    return rows.map((row) => ({
      periodStart: row.periodStart,
      salesWithVat: Number(row.salesWithVat ?? 0),
    }));
  }

  async getMarketStructure(
    scope: SuppliersAnalyticsBaseScope,
  ): Promise<SuppliersAnalyticsMarketStructure> {
    const [topBuyer, topBuyerRegion, topUKTZED, top5BuyersShare] =
      await Promise.all([
        this.getTopBuyer(scope),
        this.getTopBuyerRegion(scope),
        this.getTopUktzed(scope),
        this.getTopGroupShare(scope, 5),
      ]);

    return {
      topBuyer,
      topBuyerRegion,
      topUKTZED,
      top5BuyersShare,
    };
  }

  async getTopBuyers(
    scope: SuppliersAnalyticsBaseScope,
    limit = 5,
  ): Promise<SuppliersAnalyticsTopEntity[]> {
    return this.getTopEntityList(scope, limit);
  }

  async getTopProducts(
    scope: SuppliersAnalyticsBaseScope,
    limit = 5,
  ): Promise<SuppliersAnalyticsTopProduct[]> {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const outputProductSql = this.buildOutputProductSql();
    const outputUktzedSql = this.buildOutputUktzedSql();
    const amountWithVatSql = this.amountWithVatSql();
    const whereSql = this.buildBaseScopeSql(scope);

    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string | null;
        name: string | null;
        uktzed: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          NULLIF(${outputProductSql}, '') AS product_id,
          NULLIF(${outputProductSql}, '') AS name,
          NULLIF(${outputUktzedSql}, '') AS uktzed,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND NULLIF(${outputProductSql}, '') IS NOT NULL
        GROUP BY 1, 2, 3
      ),
      totals AS (
        SELECT COALESCE(SUM(amount), 0) AS total_amount FROM grouped
      )
      SELECT
        grouped.product_id AS "productId",
        grouped.name AS name,
        grouped.uktzed AS uktzed,
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.name ASC NULLS LAST
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      uktzed: row.uktzed,
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    }));
  }

  async getTopRegions(
    scope: SuppliersAnalyticsBaseScope,
    limit = 5,
  ): Promise<SuppliersAnalyticsTopRegion[]> {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const amountWithVatSql = this.amountWithVatSql();
    const whereSql = this.buildBaseScopeSql(scope);

    const rows = await this.prisma.$queryRaw<
      Array<{
        regionCode: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
        activeBuyers: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS region_code,
          SUM(${amountWithVatSql}) AS amount,
          COUNT(DISTINCT ${buyerIdentitySql}) AS active_buyers
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${buyerIdentitySql} IS NOT NULL
          AND ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} IS NOT NULL
        GROUP BY 1
      ),
      totals AS (
        SELECT COALESCE(SUM(amount), 0) AS total_amount FROM grouped
      )
      SELECT
        grouped.region_code AS "regionCode",
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share,
        grouped.active_buyers AS "activeBuyers"
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.region_code ASC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      regionCode: this.resolveRegionCode(row.regionCode),
      regionName: this.resolveRegionName(row.regionCode),
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
      activeBuyers: Number(row.activeBuyers ?? 0),
    }));
  }

  async getSuppliersTable(
    scope: SuppliersAnalyticsBaseScope,
    options: {
      timeGrain: SuppliersAnalyticsTimeGrain;
      page: number;
      limit: number;
      sortBy: SuppliersAnalyticsTableSortField;
      sortDirection: 'asc' | 'desc';
    },
  ): Promise<SuppliersAnalyticsTableResult> {
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const amountWithVatSql = this.amountWithVatSql();
    const bucketExpressionSql = this.buildBucketExpressionSql(
      options.timeGrain,
    );
    const outputProductSql = this.buildOutputProductSql();
    const outputUktzedSql = this.buildOutputUktzedSql();
    const normalizedUnitSql = this.buildNormalizedTextSql('record."unit_name"');
    const whereSql = this.buildBaseScopeSql(scope);
    const offset = (options.page - 1) * options.limit;
    const orderBySql = this.buildSuppliersTableOrderBySql(
      options.sortBy,
      options.sortDirection,
    );

    const rows = await this.prisma.$queryRaw<
      Array<{
        periodStart: Date;
        buyerRegionCode: string | null;
        buyerTaxNumber: string | null;
        buyerName: string | null;
        product: string | null;
        uktzed: string | null;
        unit: string | null;
        quantity: Prisma.Decimal | null;
        priceWithVat: Prisma.Decimal | null;
        salesWithVat: Prisma.Decimal | null;
        marketShare: Prisma.Decimal | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${bucketExpressionSql} AS period_start,
          ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS buyer_region_code,
          ${buyerIdentitySql} AS buyer_tax_number,
          MIN(NULLIF(BTRIM(record."buyer_name"), '')) AS buyer_name,
          NULLIF(${outputProductSql}, '') AS product,
          NULLIF(${outputUktzedSql}, '') AS uktzed,
          NULLIF(${normalizedUnitSql}, '') AS unit,
          SUM(COALESCE(record."quantity", 0)) AS quantity,
          COALESCE(
            SUM(
              CASE
                WHEN ${supplierIdentitySql} IS NOT NULL THEN ${amountWithVatSql}
                ELSE 0
              END
            ),
            0
          ) AS sales_with_vat
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
        GROUP BY 1, 2, 3, 5, 6, 7
      ),
      totals AS (
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(grouped.sales_with_vat), 0) AS total_sales_amount
        FROM grouped
      )
      SELECT
        grouped.period_start AS "periodStart",
        grouped.buyer_region_code AS "buyerRegionCode",
        grouped.buyer_tax_number AS "buyerTaxNumber",
        grouped.buyer_name AS "buyerName",
        grouped.product AS product,
        grouped.uktzed AS uktzed,
        grouped.unit AS unit,
        grouped.quantity AS quantity,
        CASE
          WHEN COALESCE(grouped.quantity, 0) = 0 THEN NULL
          WHEN grouped.sales_with_vat <> 0 THEN grouped.sales_with_vat / grouped.quantity
          ELSE NULL
        END AS "priceWithVat",
        grouped.sales_with_vat AS "salesWithVat",
        CASE
          WHEN totals.total_sales_amount = 0 THEN 0
          ELSE grouped.sales_with_vat / totals.total_sales_amount * 100
        END AS "marketShare",
        totals.total_count AS "totalCount"
      FROM grouped
      CROSS JOIN totals
      ORDER BY ${orderBySql}
      LIMIT ${options.limit}
      OFFSET ${offset}
    `);

    return {
      items: rows.map((row) => this.mapSuppliersTableRow(row)),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  async getFilterOptions(
    scope: SuppliersAnalyticsBaseScope,
    dimension: SuppliersAnalyticsFilterOptionDimension,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: Array<{ value: string; label: string | null }>;
    total: number;
  }> {
    switch (dimension) {
      case 'suppliers':
        return this.getEntityFilterOptions(scope, options, 'supplier', false);
      case 'buyers':
        return this.getEntityFilterOptions(scope, options, 'buyer', true);
      case 'products':
        return this.getProductFilterOptions(scope, options);
      case 'uktzed':
        return this.getUktzedFilterOptions(scope, options);
      case 'buyerRegions':
        return this.getBuyerRegionFilterOptions(scope, options);
    }
  }

  resolveRegionCode(code: string | null | undefined): string | null {
    const normalized = this.normalizeText(code);

    if (!normalized) {
      return null;
    }

    const compact = normalized.replaceAll(' ', '');

    if (!/^\d+$/u.test(compact)) {
      return ANALYTICS_UNKNOWN_REGION_CODE;
    }

    const resolved = String(Number(compact));

    return Object.hasOwn(ANALYTICS_REGION_DICTIONARY, resolved)
      ? resolved
      : ANALYTICS_UNKNOWN_REGION_CODE;
  }

  resolveRegionName(code: string | null | undefined): string | null {
    const regionCode = this.resolveRegionCode(code);

    if (!regionCode) {
      return null;
    }

    return (
      ANALYTICS_REGION_DICTIONARY[
        regionCode as keyof typeof ANALYTICS_REGION_DICTIONARY
      ] ?? ANALYTICS_UNKNOWN_REGION_NAME
    );
  }

  private async getEntityFilterOptions(
    scope: SuppliersAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
    role: 'supplier' | 'buyer',
    includeSupplierFilter: boolean,
  ): Promise<{
    items: Array<{ value: string; label: string | null }>;
    total: number;
  }> {
    const identitySql =
      role === 'supplier'
        ? this.buildCompanyIdentitySql(
            'record."seller_tax_number"',
            'record."seller_name"',
          )
        : this.buildCompanyIdentitySql(
            'record."buyer_tax_number"',
            'record."buyer_name"',
          );
    const nameColumn =
      role === 'supplier' ? 'record."seller_name"' : 'record."buyer_name"';
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;
    const whereSql = this.buildBaseScopeSql(scope, { includeSupplierFilter });
    const offset = (options.page - 1) * options.limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        value: string | null;
        label: string | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${identitySql} AS value,
          MIN(NULLIF(BTRIM(${Prisma.raw(nameColumn)}), '')) AS label
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${identitySql} IS NOT NULL
        GROUP BY 1
      ),
      filtered AS (
        SELECT
          grouped.value AS value,
          grouped.label AS label
        FROM grouped
        WHERE ${
          search
            ? Prisma.sql`(
                LOWER(COALESCE(grouped.label, '')) LIKE ${`%${search}%`}
                OR LOWER(COALESCE(grouped.value, '')) LIKE ${`%${search}%`}
              )`
            : Prisma.sql`TRUE`
        }
      ),
      paginated AS (
        SELECT
          filtered.value AS value,
          filtered.label AS label,
          COUNT(*) OVER() AS total_count
        FROM filtered
        ORDER BY filtered.label ASC NULLS LAST, filtered.value ASC
        LIMIT ${options.limit}
        OFFSET ${offset}
      )
      SELECT
        paginated.value AS value,
        paginated.label AS label,
        paginated.total_count AS "totalCount"
      FROM paginated
    `);

    return {
      items: this.compactFilterOptionItems(
        rows.map((row) =>
          row.value
            ? {
                value: row.value,
                label: row.label,
              }
            : null,
        ),
      ),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getProductFilterOptions(
    scope: SuppliersAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: Array<{ value: string; label: string | null }>;
    total: number;
  }> {
    const whereSql = this.buildBaseScopeSql(scope);
    const outputProductSql = this.buildOutputProductSql();
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;
    const offset = (options.page - 1) * options.limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        value: string | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT DISTINCT NULLIF(${outputProductSql}, '') AS value
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND NULLIF(${outputProductSql}, '') IS NOT NULL
      ),
      filtered AS (
        SELECT grouped.value AS value
        FROM grouped
        WHERE ${
          search
            ? Prisma.sql`LOWER(COALESCE(grouped.value, '')) LIKE ${`%${search}%`}`
            : Prisma.sql`TRUE`
        }
      ),
      paginated AS (
        SELECT
          filtered.value AS value,
          COUNT(*) OVER() AS total_count
        FROM filtered
        ORDER BY filtered.value ASC
        LIMIT ${options.limit}
        OFFSET ${offset}
      )
      SELECT
        paginated.value AS value,
        paginated.total_count AS "totalCount"
      FROM paginated
    `);

    return {
      items: this.compactFilterOptionItems(
        rows.map((row) =>
          row.value
            ? {
                value: row.value,
                label: row.value,
              }
            : null,
        ),
      ),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getUktzedFilterOptions(
    scope: SuppliersAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: Array<{ value: string; label: string | null }>;
    total: number;
  }> {
    const whereSql = this.buildBaseScopeSql(scope);
    const outputUktzedSql = this.buildOutputUktzedSql();
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;
    const offset = (options.page - 1) * options.limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        value: string | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT DISTINCT NULLIF(${outputUktzedSql}, '') AS value
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND NULLIF(${outputUktzedSql}, '') IS NOT NULL
      ),
      filtered AS (
        SELECT grouped.value AS value
        FROM grouped
        WHERE ${
          search
            ? Prisma.sql`LOWER(COALESCE(grouped.value, '')) LIKE ${`%${search}%`}`
            : Prisma.sql`TRUE`
        }
      ),
      paginated AS (
        SELECT
          filtered.value AS value,
          COUNT(*) OVER() AS total_count
        FROM filtered
        ORDER BY filtered.value ASC
        LIMIT ${options.limit}
        OFFSET ${offset}
      )
      SELECT
        paginated.value AS value,
        paginated.total_count AS "totalCount"
      FROM paginated
    `);

    return {
      items: this.compactFilterOptionItems(
        rows.map((row) =>
          row.value
            ? {
                value: row.value,
                label: row.value,
              }
            : null,
        ),
      ),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getBuyerRegionFilterOptions(
    scope: SuppliersAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: Array<{ value: string; label: string | null }>;
    total: number;
  }> {
    const whereSql = this.buildBaseScopeSql(scope);
    const offset = (options.page - 1) * options.limit;
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;

    const rows = await this.prisma.$queryRaw<
      Array<{
        regionCode: string | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT DISTINCT ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS region_code
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} IS NOT NULL
      ),
      mapped AS (
        SELECT grouped.region_code AS region_code
        FROM grouped
      ),
      filtered AS (
        SELECT mapped.region_code AS region_code
        FROM mapped
        WHERE ${this.buildBuyerRegionSearchSql(search)}
      ),
      paginated AS (
        SELECT
          filtered.region_code AS region_code,
          COUNT(*) OVER() AS total_count
        FROM filtered
        ORDER BY filtered.region_code ASC
        LIMIT ${options.limit}
        OFFSET ${offset}
      )
      SELECT
        paginated.region_code AS "regionCode",
        paginated.total_count AS "totalCount"
      FROM paginated
    `);

    return {
      items: rows
        .map((row) => {
          const value = this.resolveRegionCode(row.regionCode);

          return value
            ? {
                value,
                label: this.resolveRegionName(row.regionCode),
              }
            : null;
        })
        .filter(
          (
            item,
          ): item is {
            value: string;
            label: string | null;
          } => item !== null,
        ),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getTopBuyer(
    scope: SuppliersAnalyticsBaseScope,
  ): Promise<SuppliersAnalyticsMarketEntity | null> {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildTopEntityQuery(scope, 1));

    return this.toMarketEntity(row);
  }

  private async getTopBuyerRegion(
    scope: SuppliersAnalyticsBaseScope,
  ): Promise<SuppliersAnalyticsMarketRegion | null> {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const amountWithVatSql = this.amountWithVatSql();
    const whereSql = this.buildBaseScopeSql(scope);

    const [row] = await this.prisma.$queryRaw<
      Array<{
        regionCode: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS region_code,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} IS NOT NULL
        GROUP BY 1
      ),
      totals AS (
        SELECT COALESCE(SUM(amount), 0) AS total_amount FROM grouped
      )
      SELECT
        grouped.region_code AS "regionCode",
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.region_code ASC
      LIMIT 1
    `);

    if (!row) {
      return null;
    }

    return {
      regionCode: this.resolveRegionCode(row.regionCode),
      regionName: this.resolveRegionName(row.regionCode),
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    };
  }

  private async getTopUktzed(
    scope: SuppliersAnalyticsBaseScope,
  ): Promise<SuppliersAnalyticsMarketUktzed | null> {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const outputUktzedSql = this.buildOutputUktzedSql();
    const amountWithVatSql = this.amountWithVatSql();
    const whereSql = this.buildBaseScopeSql(scope);

    const [row] = await this.prisma.$queryRaw<
      Array<{
        code: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          NULLIF(${outputUktzedSql}, '') AS code,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND NULLIF(${outputUktzedSql}, '') IS NOT NULL
        GROUP BY 1
      ),
      totals AS (
        SELECT COALESCE(SUM(amount), 0) AS total_amount FROM grouped
      )
      SELECT
        grouped.code AS code,
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.code ASC
      LIMIT 1
    `);

    if (!row) {
      return null;
    }

    return {
      code: row.code,
      name: row.code,
      description: null,
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    };
  }

  private async getTopGroupShare(
    scope: SuppliersAnalyticsBaseScope,
    limit: number,
  ): Promise<number> {
    const amountWithVatSql = this.amountWithVatSql();
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const whereSql = this.buildBaseScopeSql(scope);

    const [row] = await this.prisma.$queryRaw<
      Array<{
        share: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${buyerIdentitySql} AS identity_key,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${buyerIdentitySql} IS NOT NULL
        GROUP BY 1
      ),
      ranked AS (
        SELECT amount
        FROM grouped
        ORDER BY amount DESC, identity_key ASC
        LIMIT ${limit}
      ),
      totals AS (
        SELECT COALESCE(SUM(amount), 0) AS total_amount FROM grouped
      )
      SELECT
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE COALESCE((SELECT SUM(amount) FROM ranked), 0) / totals.total_amount * 100
        END AS share
      FROM totals
    `);

    return Number(row?.share ?? 0);
  }

  private async getTopEntityList(
    scope: SuppliersAnalyticsBaseScope,
    limit: number,
  ): Promise<SuppliersAnalyticsTopEntity[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildTopEntityQuery(scope, limit));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    }));
  }

  private buildTopEntityQuery(
    scope: SuppliersAnalyticsBaseScope,
    limit: number,
  ): Prisma.Sql {
    const amountWithVatSql = this.amountWithVatSql();
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const whereSql = this.buildBaseScopeSql(scope);

    return Prisma.sql`
      WITH grouped AS (
        SELECT
          ${buyerIdentitySql} AS id,
          MIN(NULLIF(BTRIM(record."buyer_name"), '')) AS name,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${buyerIdentitySql} IS NOT NULL
        GROUP BY 1
      ),
      totals AS (
        SELECT COALESCE(SUM(amount), 0) AS total_amount FROM grouped
      )
      SELECT
        grouped.id AS id,
        grouped.name AS name,
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.id ASC
      LIMIT ${limit}
    `;
  }

  private toMarketEntity(
    row:
      | {
          id: string | null;
          name: string | null;
          amount: Prisma.Decimal | null;
          share: Prisma.Decimal | null;
        }
      | undefined,
  ): SuppliersAnalyticsMarketEntity | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    };
  }

  private mapSuppliersTableRow(row: {
    periodStart: Date;
    buyerRegionCode: string | null;
    buyerTaxNumber: string | null;
    buyerName: string | null;
    product: string | null;
    uktzed: string | null;
    unit: string | null;
    quantity: Prisma.Decimal | null;
    priceWithVat: Prisma.Decimal | null;
    salesWithVat: Prisma.Decimal | null;
    marketShare: Prisma.Decimal | null;
  }): SuppliersAnalyticsTableItem {
    return {
      periodStart: row.periodStart,
      buyerRegionCode: this.resolveRegionCode(row.buyerRegionCode),
      buyerTaxNumber: row.buyerTaxNumber,
      buyerName: row.buyerName,
      product: row.product,
      uktzed: row.uktzed,
      unit: row.unit,
      quantity: row.quantity === null ? null : Number(row.quantity),
      priceWithVat: row.priceWithVat === null ? null : Number(row.priceWithVat),
      salesWithVat: Number(row.salesWithVat ?? 0),
      marketShare: Number(row.marketShare ?? 0),
    };
  }

  private buildSuppliersTableOrderBySql(
    sortBy: SuppliersAnalyticsTableSortField,
    sortDirection: 'asc' | 'desc',
  ): Prisma.Sql {
    const directionSql =
      sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    switch (sortBy) {
      case 'period':
        return Prisma.sql`grouped.period_start ${directionSql}, grouped.buyer_tax_number ASC NULLS LAST`;
      case 'buyerRegion':
        return Prisma.sql`grouped.buyer_region_code ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'buyer':
        return Prisma.sql`grouped.buyer_name ${directionSql} NULLS LAST, grouped.buyer_tax_number ${directionSql} NULLS LAST`;
      case 'product':
        return Prisma.sql`grouped.product ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'uktzed':
        return Prisma.sql`grouped.uktzed ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'unit':
        return Prisma.sql`grouped.unit ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'quantity':
        return Prisma.sql`grouped.quantity ${directionSql}, grouped.period_start DESC`;
      case 'priceWithVat':
        return Prisma.sql`"priceWithVat" ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'salesWithVat':
        return Prisma.sql`grouped.sales_with_vat ${directionSql}, grouped.period_start DESC`;
      case 'marketShare':
        return Prisma.sql`"marketShare" ${directionSql}, grouped.period_start DESC`;
    }
  }

  private buildBaseScopeSql(
    scope: SuppliersAnalyticsBaseScope,
    options?: {
      includeSupplierFilter?: boolean;
    },
  ): Prisma.Sql {
    const includeSupplierFilter = options?.includeSupplierFilter ?? true;
    const conditions: Prisma.Sql[] = [
      Prisma.sql`record."userId" = ${scope.userId}`,
      Prisma.sql`record."is_canonical" = TRUE`,
      Prisma.sql`COALESCE(record."is_excluded", FALSE) = FALSE`,
      Prisma.sql`record."invoice_date" >= ${scope.dateRange.from}`,
      Prisma.sql`record."invoice_date" <= ${scope.dateRange.to}`,
    ];

    if (includeSupplierFilter && scope.filters.supplierTaxNumbers.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildCompanyIdentitySql(
            'record."seller_tax_number"',
            'record."seller_name"',
          ),
          scope.filters.supplierTaxNumbers,
        ),
      );
    }

    if (scope.filters.buyerTaxNumbers.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildCompanyIdentitySql(
            'record."buyer_tax_number"',
            'record."buyer_name"',
          ),
          scope.filters.buyerTaxNumbers,
        ),
      );
    }

    if (scope.filters.buyerRegionCodes.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildResolvedRegionGroupSql('record."buyer_region_code"'),
          scope.filters.buyerRegionCodes,
        ),
      );
    }

    if (scope.filters.uktzedValues.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildNormalizedUktzedSql(),
          scope.filters.uktzedValues,
        ),
      );
    }

    if (scope.filters.products.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildOutputProductSql(),
          scope.filters.products,
        ),
      );
    }

    return Prisma.join(conditions, ' AND ');
  }

  private buildBuyerRegionSearchSql(search: string | null): Prisma.Sql {
    if (!search) {
      return Prisma.sql`TRUE`;
    }

    const matchingCodes = Object.entries(ANALYTICS_REGION_DICTIONARY)
      .filter(([, label]) => label.toLowerCase().includes(search))
      .map(([code]) => code);
    const normalizedSearch = `%${search}%`;

    if (ANALYTICS_UNKNOWN_REGION_NAME.toLowerCase().includes(search)) {
      matchingCodes.push(ANALYTICS_UNKNOWN_REGION_CODE);
    }

    if (matchingCodes.length === 0) {
      return Prisma.sql`LOWER(COALESCE(mapped.region_code, '')) LIKE ${normalizedSearch}`;
    }

    return Prisma.sql`(
      LOWER(COALESCE(mapped.region_code, '')) LIKE ${normalizedSearch}
      OR ${this.resolveRegionCodeCaseSql('mapped.region_code')} IN (${Prisma.join(
        matchingCodes,
      )})
    )`;
  }

  private buildSqlEqualsAnyCondition(
    expression: Prisma.Sql,
    values: string[],
  ): Prisma.Sql {
    return Prisma.sql`(${Prisma.join(
      values.map((value) => Prisma.sql`${expression} = ${value}`),
      ' OR ',
    )})`;
  }

  private compactFilterOptionItems(
    items: Array<{ value: string; label: string | null } | null>,
  ): Array<{ value: string; label: string | null }> {
    return items.filter(
      (
        item,
      ): item is {
        value: string;
        label: string | null;
      } => item !== null,
    );
  }

  private buildCompanyIdentitySql(
    taxNumberColumn: string,
    nameColumn: string,
  ): Prisma.Sql {
    const normalizedTaxSql = this.buildNormalizedTaxSql(taxNumberColumn);
    const normalizedNameSql = this.buildNormalizedTextSql(nameColumn);

    return Prisma.sql`
      CASE
        WHEN ${normalizedTaxSql} IS NULL THEN NULL
        WHEN ${normalizedTaxSql} = '0' AND ${normalizedNameSql} = 'неплатник' THEN '0'
        WHEN ${normalizedTaxSql} ~ '^[0-9]+$' THEN ${normalizedTaxSql}
        ELSE NULL
      END
    `;
  }

  private buildResolvedRegionGroupSql(column: string): Prisma.Sql {
    const knownCodes = Object.keys(ANALYTICS_REGION_DICTIONARY);
    const normalizedCodeSql = this.resolveRegionCodeCaseSql(column);

    return Prisma.sql`
      CASE
        WHEN ${normalizedCodeSql} IS NULL THEN NULL
        WHEN ${normalizedCodeSql} IN (${Prisma.join(knownCodes)}) THEN ${normalizedCodeSql}
        ELSE ${ANALYTICS_UNKNOWN_REGION_CODE}
      END
    `;
  }

  private resolveRegionCodeCaseSql(column: string): Prisma.Sql {
    return Prisma.sql`
      CASE
        WHEN NULLIF(BTRIM(COALESCE(${Prisma.raw(column)}, '')), '') IS NULL THEN NULL
        WHEN BTRIM(COALESCE(${Prisma.raw(column)}, '')) = '0' THEN '0'
        WHEN BTRIM(COALESCE(${Prisma.raw(column)}, '')) ~ '^[0-9]+$'
          THEN CAST(CAST(BTRIM(COALESCE(${Prisma.raw(column)}, '')) AS integer) AS text)
        ELSE BTRIM(COALESCE(${Prisma.raw(column)}, ''))
      END
    `;
  }

  private buildNormalizedTaxSql(column: string): Prisma.Sql {
    return Prisma.sql`
      NULLIF(
        REGEXP_REPLACE(
          BTRIM(COALESCE(${Prisma.raw(column)}, '')),
          '\\s+',
          '',
          'g'
        ),
        ''
      )
    `;
  }

  private buildNormalizedTextSql(column: string): Prisma.Sql {
    return Prisma.sql`
      NULLIF(
        REGEXP_REPLACE(
          BTRIM(COALESCE(${Prisma.raw(column)}, '')),
          '\\s+',
          ' ',
          'g'
        ),
        ''
      )
    `;
  }

  private buildNormalizedProductSql(): Prisma.Sql {
    return Prisma.sql`
      NULLIF(
        REGEXP_REPLACE(
          BTRIM(COALESCE(record."item_description", '')),
          '\\s+',
          ' ',
          'g'
        ),
        ''
      )
    `;
  }

  private buildOutputProductSql(): Prisma.Sql {
    return Prisma.sql`
      NULLIF(BTRIM(COALESCE(record."item_description", '')), '')
    `;
  }

  private buildNormalizedUktzedSql(): Prisma.Sql {
    return Prisma.sql`
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          BTRIM(COALESCE(record."uktzed_code", '')),
          '\\s+',
          '',
          'g'
        ),
        '\\.0+$',
        ''
      )
    `;
  }

  private buildOutputUktzedSql(): Prisma.Sql {
    return Prisma.sql`
      REGEXP_REPLACE(
        BTRIM(COALESCE(record."uktzed_code", '')),
        '\\s+',
        '',
        'g'
      )
    `;
  }

  private normalizeUktzedValues(values?: string[]): string[] {
    return this.normalizeStringValues(values).map((value) =>
      value.replaceAll(' ', '').replace(/\.0+$/u, ''),
    );
  }

  private normalizeTaxNumbers(values?: string[]): string[] {
    return this.normalizeStringValues(values)
      .map((value) => this.normalizeTaxNumber(value))
      .filter((value): value is string => value !== null);
  }

  private normalizeRegionCodes(values?: string[]): string[] {
    return this.normalizeStringValues(values)
      .map((value) => this.resolveRegionCode(value))
      .filter((value): value is string => value !== null);
  }

  private normalizeStringValues(values?: string[]): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    return [
      ...new Set(
        values
          .map((value) => this.normalizeText(value))
          .filter((value): value is string => value !== null),
      ),
    ];
  }

  private normalizePreservedStringValues(values?: string[]): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    return [
      ...new Set(
        values
          .map((value) => this.normalizePreservedText(value))
          .filter((value): value is string => value !== null),
      ),
    ];
  }

  private normalizeTaxNumber(value: string | null | undefined): string | null {
    const normalized = this.normalizeText(value);

    if (!normalized) {
      return null;
    }

    if (normalized === '0') {
      return normalized;
    }

    const compact = normalized.replaceAll(' ', '');

    return /^\d+$/u.test(compact) ? compact : null;
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();

    return normalized.length > 0 ? normalized : null;
  }

  private normalizePreservedText(
    value: string | null | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.normalize('NFC').trim();

    return normalized.length > 0 ? normalized : null;
  }

  private toStartOfDayUtc(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toEndOfDayUtc(date: string): Date {
    return new Date(`${date}T23:59:59.999Z`);
  }

  private amountWithVatSql(): Prisma.Sql {
    return Prisma.sql`COALESCE(record."supply_amount_without_vat", 0) + COALESCE(record."vat_amount", 0)`;
  }

  private buildBucketExpressionSql(
    timeGrain: SuppliersAnalyticsTimeGrain,
  ): Prisma.Sql {
    switch (timeGrain) {
      case 'MONTH':
        return Prisma.sql`date_trunc('month', record."invoice_date"::date::timestamp)`;
      case 'QUARTER':
        return Prisma.sql`date_trunc('quarter', record."invoice_date"::date::timestamp)`;
      case 'YEAR':
        return Prisma.sql`date_trunc('year', record."invoice_date"::date::timestamp)`;
    }
  }

  private buildSeriesStepSql(
    timeGrain: SuppliersAnalyticsTimeGrain,
  ): Prisma.Sql {
    switch (timeGrain) {
      case 'MONTH':
        return Prisma.sql`'1 month'::interval`;
      case 'QUARTER':
        return Prisma.sql`'3 months'::interval`;
      case 'YEAR':
        return Prisma.sql`'1 year'::interval`;
    }
  }

  private getBucketStartDate(
    date: Date,
    timeGrain: SuppliersAnalyticsTimeGrain,
  ): Date {
    const bucketStart = new Date(date);
    bucketStart.setUTCHours(0, 0, 0, 0);

    switch (timeGrain) {
      case 'MONTH':
        bucketStart.setUTCDate(1);
        return bucketStart;
      case 'QUARTER': {
        const month = bucketStart.getUTCMonth();
        const quarterStartMonth = Math.floor(month / 3) * 3;
        bucketStart.setUTCMonth(quarterStartMonth, 1);
        return bucketStart;
      }
      case 'YEAR':
        bucketStart.setUTCMonth(0, 1);
        return bucketStart;
    }
  }
}
