import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ANALYTICS_REGION_DICTIONARY,
  ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES,
  ANALYTICS_UNKNOWN_REGION_NAME,
} from './constants/overview.constants';
import { OverviewBaseQueryDto } from './dto/overview-base-query.dto';
import type {
  AnalyticsBaseScope,
  AnalyticsCompanyIdentity,
  AnalyticsFilterOptionDimension,
  AnalyticsKpiTotals,
  AnalyticsMarketEntity,
  AnalyticsMarketRegion,
  AnalyticsMarketStructure,
  AnalyticsMarketUktzed,
  AnalyticsOverviewTableResult,
  AnalyticsTimeGrain,
  AnalyticsTableSortField,
  AnalyticsTopEntity,
  AnalyticsTopProduct,
  AnalyticsTopRegion,
  AnalyticsTrendPoint,
} from './types/overview.types';

@Injectable()
export class OverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  resolveRegionCode(code: string | null | undefined): string | null {
    const normalized = this.normalizeText(code);

    if (!normalized) {
      return null;
    }

    if (normalized === '0') {
      return normalized;
    }

    const compact = normalized.replaceAll(' ', '');

    if (!/^\d+$/u.test(compact)) {
      return normalized;
    }

    return String(Number(compact));
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

  createBaseScope(
    userId: string,
    query: OverviewBaseQueryDto,
  ): AnalyticsBaseScope {
    return {
      userId,
      dateRange: {
        from: this.toStartOfDayUtc(query.dateFrom),
        to: this.toEndOfDayUtc(query.dateTo),
      },
      filters: {
        uktzedPrefixes: this.normalizeUktzedPrefixes(query.uktzed),
        normalizedProducts: this.normalizeProducts(query.products),
        buyerRegionCodes: this.normalizeRegionCodes(query.buyerRegionCodes),
        buyerTaxNumbers: this.normalizeTaxNumbers(query.buyerTaxNumbers),
        supplierTaxNumbers: this.normalizeTaxNumbers(query.supplierTaxNumbers),
      },
    };
  }

  buildBaseWhere(scope: AnalyticsBaseScope): Prisma.RegistryRecordWhereInput {
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

    if (scope.filters.buyerRegionCodes.length > 0) {
      where.buyerRegionCode = {
        in: scope.filters.buyerRegionCodes,
      };
    }

    if (scope.filters.buyerTaxNumbers.length > 0) {
      where.buyerTaxNumber = {
        in: scope.filters.buyerTaxNumbers,
      };
    }

    if (scope.filters.supplierTaxNumbers.length > 0) {
      where.sellerTaxNumber = {
        in: scope.filters.supplierTaxNumbers,
      };
    }

    if (scope.filters.uktzedPrefixes.length > 0) {
      where.OR = scope.filters.uktzedPrefixes.map((prefix) => ({
        uktzedCode: {
          startsWith: prefix,
        },
      }));
    }

    return where;
  }

  async getKpiTotals(scope: AnalyticsBaseScope): Promise<AnalyticsKpiTotals> {
    const amountWithVatSql = Prisma.sql`COALESCE(record."supply_amount_without_vat", 0) + COALESCE(record."vat_amount", 0)`;
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
        salesWithVat: Prisma.Decimal | null;
        purchasesWithVat: Prisma.Decimal | null;
        activeBuyers: bigint | number;
        activeSuppliers: bigint | number;
        salesRegions: bigint | number;
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
        COALESCE(
          SUM(
            CASE
              WHEN ${buyerIdentitySql} IS NOT NULL THEN ${amountWithVatSql}
              ELSE 0
            END
          ),
          0
        ) AS "purchasesWithVat",
        COUNT(
          DISTINCT CASE
            WHEN ${supplierIdentitySql} IS NOT NULL THEN ${buyerIdentitySql}
            ELSE NULL
          END
        ) AS "activeBuyers",
        COUNT(
          DISTINCT CASE
            WHEN ${buyerIdentitySql} IS NOT NULL THEN ${supplierIdentitySql}
            ELSE NULL
          END
        ) AS "activeSuppliers",
        COUNT(
          DISTINCT CASE
            WHEN ${supplierIdentitySql} IS NOT NULL
             AND record."buyer_region_code" IS NOT NULL
             AND BTRIM(record."buyer_region_code") <> ''
            THEN BTRIM(record."buyer_region_code")
            ELSE NULL
          END
        ) AS "salesRegions"
      FROM "RegistryRecord" AS record
      WHERE ${whereSql}
    `);

    return {
      salesWithVat: Number(row?.salesWithVat ?? 0),
      purchasesWithVat: Number(row?.purchasesWithVat ?? 0),
      activeBuyers: Number(row?.activeBuyers ?? 0),
      activeSuppliers: Number(row?.activeSuppliers ?? 0),
      salesRegions: Number(row?.salesRegions ?? 0),
    };
  }

  async getTrendPoints(
    scope: AnalyticsBaseScope,
    timeGrain: AnalyticsTimeGrain,
  ): Promise<AnalyticsTrendPoint[]> {
    const amountWithVatSql = Prisma.sql`COALESCE(record."supply_amount_without_vat", 0) + COALESCE(record."vat_amount", 0)`;
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
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
        purchasesWithVat: Prisma.Decimal | null;
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
          ) AS sales_with_vat,
          COALESCE(
            SUM(
              CASE
                WHEN ${buyerIdentitySql} IS NOT NULL THEN ${amountWithVatSql}
                ELSE 0
              END
            ),
            0
          ) AS purchases_with_vat
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
        GROUP BY 1
      )
      SELECT
        buckets.bucket_start AS "periodStart",
        COALESCE(aggregated.sales_with_vat, 0) AS "salesWithVat",
        COALESCE(aggregated.purchases_with_vat, 0) AS "purchasesWithVat"
      FROM buckets
      LEFT JOIN aggregated
        ON aggregated.bucket_start = buckets.bucket_start
      ORDER BY buckets.bucket_start ASC
    `);

    return rows.map((row) => ({
      periodStart: row.periodStart,
      salesWithVat: Number(row.salesWithVat ?? 0),
      purchasesWithVat: Number(row.purchasesWithVat ?? 0),
    }));
  }

  async getMarketStructure(
    scope: AnalyticsBaseScope,
  ): Promise<AnalyticsMarketStructure> {
    const [
      topBuyer,
      topSupplier,
      topBuyerRegion,
      topUKTZED,
      top5BuyersShare,
      top5SuppliersShare,
    ] = await Promise.all([
      this.getTopBuyer(scope),
      this.getTopSupplier(scope),
      this.getTopBuyerRegion(scope),
      this.getTopUktzed(scope),
      this.getTopGroupShare(scope, 5, 'buyer'),
      this.getTopGroupShare(scope, 5, 'supplier'),
    ]);

    return {
      topBuyer,
      topSupplier,
      topBuyerRegion,
      topUKTZED,
      top5BuyersShare,
      top5SuppliersShare,
    };
  }

  async getTopBuyers(
    scope: AnalyticsBaseScope,
    limit = 5,
  ): Promise<AnalyticsTopEntity[]> {
    return this.getTopEntityList(scope, limit, 'buyer');
  }

  async getTopSuppliers(
    scope: AnalyticsBaseScope,
    limit = 5,
  ): Promise<AnalyticsTopEntity[]> {
    return this.getTopEntityList(scope, limit, 'supplier');
  }

  async getTopProducts(
    scope: AnalyticsBaseScope,
    limit = 5,
  ): Promise<AnalyticsTopProduct[]> {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const normalizedProductSql = this.buildNormalizedProductSql();
    const normalizedUktzedSql = this.buildNormalizedUktzedSql();
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
          NULLIF(${normalizedProductSql}, '') AS product_id,
          NULLIF(${normalizedProductSql}, '') AS name,
          NULLIF(${normalizedUktzedSql}, '') AS uktzed,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND NULLIF(${normalizedProductSql}, '') IS NOT NULL
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
    scope: AnalyticsBaseScope,
    limit = 5,
  ): Promise<AnalyticsTopRegion[]> {
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
          NULLIF(BTRIM(record."buyer_region_code"), '') AS region_code,
          SUM(${amountWithVatSql}) AS amount,
          COUNT(DISTINCT ${buyerIdentitySql}) AS active_buyers
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${buyerIdentitySql} IS NOT NULL
          AND NULLIF(BTRIM(record."buyer_region_code"), '') IS NOT NULL
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

  async getFilterOptions(
    scope: AnalyticsBaseScope,
    dimension: AnalyticsFilterOptionDimension,
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
      case 'buyers':
        return this.getEntityFilterOptions(scope, options, 'buyer');
      case 'suppliers':
        return this.getEntityFilterOptions(scope, options, 'supplier');
      case 'products':
        return this.getProductFilterOptions(scope, options);
      case 'uktzed':
        return this.getUktzedFilterOptions(scope, options);
      case 'buyerRegions':
        return this.getBuyerRegionFilterOptions(scope, options);
    }
  }

  async getOverviewTable(
    scope: AnalyticsBaseScope,
    options: {
      timeGrain: AnalyticsTimeGrain;
      page: number;
      limit: number;
      sortBy: AnalyticsTableSortField;
      sortDirection: 'asc' | 'desc';
    },
  ): Promise<AnalyticsOverviewTableResult> {
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
    const normalizedProductSql = this.buildNormalizedProductSql();
    const normalizedUktzedSql = this.buildNormalizedUktzedSql();
    const normalizedUnitSql = this.buildNormalizedTextSql('record."unit_name"');
    const whereSql = this.buildBaseScopeSql(scope);
    const offset = (options.page - 1) * options.limit;
    const orderBySql = this.buildOverviewTableOrderBySql(
      options.sortBy,
      options.sortDirection,
    );

    const rows = await this.prisma.$queryRaw<
      Array<{
        periodStart: Date;
        buyerRegionCode: string | null;
        buyerTaxNumber: string | null;
        buyerName: string | null;
        supplierTaxNumber: string | null;
        supplierName: string | null;
        product: string | null;
        uktzed: string | null;
        unit: string | null;
        quantity: Prisma.Decimal | null;
        salesWithVat: Prisma.Decimal | null;
        purchasesWithVat: Prisma.Decimal | null;
        marketShare: Prisma.Decimal | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${bucketExpressionSql} AS period_start,
          NULLIF(BTRIM(record."buyer_region_code"), '') AS buyer_region_code,
          ${buyerIdentitySql} AS buyer_tax_number,
          MIN(NULLIF(BTRIM(record."buyer_name"), '')) AS buyer_name,
          ${supplierIdentitySql} AS supplier_tax_number,
          MIN(NULLIF(BTRIM(record."seller_name"), '')) AS supplier_name,
          NULLIF(${normalizedProductSql}, '') AS product,
          NULLIF(${normalizedUktzedSql}, '') AS uktzed,
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
          ) AS sales_with_vat,
          COALESCE(
            SUM(
              CASE
                WHEN ${buyerIdentitySql} IS NOT NULL THEN ${amountWithVatSql}
                ELSE 0
              END
            ),
            0
          ) AS purchases_with_vat
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
        GROUP BY 1, 2, 3, 5, 7, 8, 9
      ),
      totals AS (
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(grouped.sales_with_vat + grouped.purchases_with_vat), 0) AS total_market_amount
        FROM grouped
      )
      SELECT
        grouped.period_start AS "periodStart",
        grouped.buyer_region_code AS "buyerRegionCode",
        grouped.buyer_tax_number AS "buyerTaxNumber",
        grouped.buyer_name AS "buyerName",
        grouped.supplier_tax_number AS "supplierTaxNumber",
        grouped.supplier_name AS "supplierName",
        grouped.product AS product,
        grouped.uktzed AS uktzed,
        grouped.unit AS unit,
        grouped.quantity AS quantity,
        grouped.sales_with_vat AS "salesWithVat",
        grouped.purchases_with_vat AS "purchasesWithVat",
        CASE
          WHEN totals.total_market_amount = 0 THEN 0
          ELSE (grouped.sales_with_vat + grouped.purchases_with_vat)
            / totals.total_market_amount * 100
        END AS "marketShare",
        totals.total_count AS "totalCount"
      FROM grouped
      CROSS JOIN totals
      ORDER BY ${orderBySql}
      LIMIT ${options.limit}
      OFFSET ${offset}
    `);

    return {
      items: rows.map((row) => ({
        periodStart: row.periodStart,
        buyerRegionCode: this.resolveRegionCode(row.buyerRegionCode),
        buyerTaxNumber: row.buyerTaxNumber,
        buyerName: row.buyerName,
        supplierTaxNumber: row.supplierTaxNumber,
        supplierName: row.supplierName,
        product: row.product,
        uktzed: row.uktzed,
        unit: row.unit,
        quantity: row.quantity === null ? null : Number(row.quantity),
        salesWithVat: Number(row.salesWithVat ?? 0),
        purchasesWithVat: Number(row.purchasesWithVat ?? 0),
        marketShare: Number(row.marketShare ?? 0),
      })),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  buildSupplierIdentity(
    taxNumber: string | null,
    name: string | null,
  ): AnalyticsCompanyIdentity {
    return this.buildCompanyIdentity(taxNumber, name);
  }

  buildBuyerIdentity(
    taxNumber: string | null,
    name: string | null,
  ): AnalyticsCompanyIdentity {
    return this.buildCompanyIdentity(taxNumber, name);
  }

  private buildCompanyIdentity(
    taxNumber: string | null,
    name: string | null,
  ): AnalyticsCompanyIdentity {
    const normalizedTaxNumber = this.normalizeTaxNumber(taxNumber);
    const normalizedName = this.normalizeText(name);

    if (!normalizedTaxNumber) {
      return {
        taxNumber: null,
        normalizedName,
        identityKey: null,
        isSemanticSpecialIdentity: false,
      };
    }

    const semanticNames =
      ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES[
        normalizedTaxNumber as keyof typeof ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES
      ];
    const normalizedSemanticNames =
      semanticNames?.map((item) => this.normalizeText(item)).filter(Boolean) ??
      [];
    const isSemanticSpecialIdentity =
      normalizedSemanticNames.length > 0 &&
      normalizedName !== null &&
      normalizedSemanticNames.includes(normalizedName);

    return {
      taxNumber: normalizedTaxNumber,
      normalizedName,
      identityKey:
        isSemanticSpecialIdentity || normalizedTaxNumber !== null
          ? normalizedTaxNumber
          : null,
      isSemanticSpecialIdentity,
    };
  }

  private normalizeUktzedPrefixes(values?: string[]): string[] {
    return this.normalizeStringValues(values).map((value) =>
      value.replaceAll(' ', '').replace(/\.0+$/u, ''),
    );
  }

  private normalizeProducts(values?: string[]): string[] {
    return this.normalizeStringValues(values).map(
      (value) => this.normalizeText(value) ?? value,
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

  private toStartOfDayUtc(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toEndOfDayUtc(date: string): Date {
    return new Date(`${date}T23:59:59.999Z`);
  }

  private buildBaseScopeSql(scope: AnalyticsBaseScope): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`record."userId" = ${scope.userId}`,
      Prisma.sql`record."is_canonical" = TRUE`,
      Prisma.sql`COALESCE(record."is_excluded", FALSE) = FALSE`,
      Prisma.sql`record."invoice_date" >= ${scope.dateRange.from}`,
      Prisma.sql`record."invoice_date" <= ${scope.dateRange.to}`,
    ];

    if (scope.filters.buyerRegionCodes.length > 0) {
      conditions.push(
        Prisma.sql`BTRIM(COALESCE(record."buyer_region_code", '')) IN (${Prisma.join(scope.filters.buyerRegionCodes)})`,
      );
    }

    if (scope.filters.buyerTaxNumbers.length > 0) {
      conditions.push(
        Prisma.sql`${this.buildCompanyIdentitySql(
          'record."buyer_tax_number"',
          'record."buyer_name"',
        )} IN (${Prisma.join(scope.filters.buyerTaxNumbers)})`,
      );
    }

    if (scope.filters.supplierTaxNumbers.length > 0) {
      conditions.push(
        Prisma.sql`${this.buildCompanyIdentitySql(
          'record."seller_tax_number"',
          'record."seller_name"',
        )} IN (${Prisma.join(scope.filters.supplierTaxNumbers)})`,
      );
    }

    if (scope.filters.uktzedPrefixes.length > 0) {
      conditions.push(
        Prisma.sql`(${Prisma.join(
          scope.filters.uktzedPrefixes.map((prefix) => {
            const normalizedPrefix = `${prefix}%`;

            return Prisma.sql`${this.buildNormalizedUktzedSql()} LIKE ${normalizedPrefix}`;
          }),
          ' OR ',
        )})`,
      );
    }

    if (scope.filters.normalizedProducts.length > 0) {
      conditions.push(
        Prisma.sql`${this.buildNormalizedProductSql()} IN (${Prisma.join(scope.filters.normalizedProducts)})`,
      );
    }

    return Prisma.join(conditions, ' AND ');
  }

  private async getTopBuyer(
    scope: AnalyticsBaseScope,
  ): Promise<AnalyticsMarketEntity | null> {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildTopEntityQuery(scope, 'buyer'));

    return this.toMarketEntity(row);
  }

  private async getTopEntityList(
    scope: AnalyticsBaseScope,
    limit: number,
    role: 'buyer' | 'supplier',
  ): Promise<AnalyticsTopEntity[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildTopEntityQuery(scope, role, limit));

    return rows
      .map((row) => this.toMarketEntity(row))
      .filter((item): item is AnalyticsTopEntity => item !== null);
  }

  private async getTopSupplier(
    scope: AnalyticsBaseScope,
  ): Promise<AnalyticsMarketEntity | null> {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildTopEntityQuery(scope, 'supplier'));

    return this.toMarketEntity(row);
  }

  private async getTopBuyerRegion(
    scope: AnalyticsBaseScope,
  ): Promise<AnalyticsMarketRegion | null> {
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
          NULLIF(BTRIM(record."buyer_region_code"), '') AS region_code,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND NULLIF(BTRIM(record."buyer_region_code"), '') IS NOT NULL
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
    scope: AnalyticsBaseScope,
  ): Promise<AnalyticsMarketUktzed | null> {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const normalizedUktzedSql = this.buildNormalizedUktzedSql();
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
          NULLIF(${normalizedUktzedSql}, '') AS code,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND NULLIF(${normalizedUktzedSql}, '') IS NOT NULL
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
      description: null,
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    };
  }

  private async getTopGroupShare(
    scope: AnalyticsBaseScope,
    limit: number,
    role: 'buyer' | 'supplier',
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
    const groupingSql =
      role === 'buyer' ? buyerIdentitySql : supplierIdentitySql;
    const gatingSql = role === 'buyer' ? supplierIdentitySql : buyerIdentitySql;
    const whereSql = this.buildBaseScopeSql(scope);

    const [row] = await this.prisma.$queryRaw<
      Array<{
        share: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${groupingSql} AS identity_key,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${gatingSql} IS NOT NULL
          AND ${groupingSql} IS NOT NULL
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

  private async getBuyerRegionFilterOptions(
    scope: AnalyticsBaseScope,
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
        SELECT DISTINCT NULLIF(BTRIM(record."buyer_region_code"), '') AS region_code
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND NULLIF(BTRIM(record."buyer_region_code"), '') IS NOT NULL
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

  private async getEntityFilterOptions(
    scope: AnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
    role: 'buyer' | 'supplier',
  ): Promise<{
    items: Array<{ value: string; label: string | null }>;
    total: number;
  }> {
    const identitySql =
      role === 'buyer'
        ? this.buildCompanyIdentitySql(
            'record."buyer_tax_number"',
            'record."buyer_name"',
          )
        : this.buildCompanyIdentitySql(
            'record."seller_tax_number"',
            'record."seller_name"',
          );
    const nameColumn =
      role === 'buyer' ? 'record."buyer_name"' : 'record."seller_name"';
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;
    const whereSql = this.buildBaseScopeSql(scope);
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
    scope: AnalyticsBaseScope,
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
    const normalizedProductSql = this.buildNormalizedProductSql();
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;
    const offset = (options.page - 1) * options.limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        value: string | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT DISTINCT NULLIF(${normalizedProductSql}, '') AS value
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND NULLIF(${normalizedProductSql}, '') IS NOT NULL
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
    scope: AnalyticsBaseScope,
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
    const normalizedUktzedSql = this.buildNormalizedUktzedSql();
    const search = this.normalizeText(options.search)?.toLowerCase() ?? null;
    const offset = (options.page - 1) * options.limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        value: string | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT DISTINCT NULLIF(${normalizedUktzedSql}, '') AS value
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND NULLIF(${normalizedUktzedSql}, '') IS NOT NULL
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

  private buildBuyerRegionSearchSql(search: string | null): Prisma.Sql {
    if (!search) {
      return Prisma.sql`TRUE`;
    }

    const matchingCodes = Object.entries(ANALYTICS_REGION_DICTIONARY)
      .filter(([, label]) => label.toLowerCase().includes(search))
      .map(([code]) => code);
    const normalizedSearch = `%${search}%`;

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

  private buildOverviewTableOrderBySql(
    sortBy: AnalyticsTableSortField,
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
      case 'supplier':
        return Prisma.sql`grouped.supplier_name ${directionSql} NULLS LAST, grouped.supplier_tax_number ${directionSql} NULLS LAST`;
      case 'product':
        return Prisma.sql`grouped.product ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'uktzed':
        return Prisma.sql`grouped.uktzed ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'unit':
        return Prisma.sql`grouped.unit ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'quantity':
        return Prisma.sql`grouped.quantity ${directionSql}, grouped.period_start DESC`;
      case 'salesWithVat':
        return Prisma.sql`grouped.sales_with_vat ${directionSql}, grouped.period_start DESC`;
      case 'purchasesWithVat':
        return Prisma.sql`grouped.purchases_with_vat ${directionSql}, grouped.period_start DESC`;
      case 'marketShare':
        return Prisma.sql`"marketShare" ${directionSql}, grouped.period_start DESC`;
    }
  }

  private buildTopEntityQuery(
    scope: AnalyticsBaseScope,
    role: 'buyer' | 'supplier',
    limit = 1,
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
    const identitySql =
      role === 'buyer' ? buyerIdentitySql : supplierIdentitySql;
    const nameColumn =
      role === 'buyer'
        ? Prisma.raw('record."buyer_name"')
        : Prisma.raw('record."seller_name"');
    const gatingSql = role === 'buyer' ? supplierIdentitySql : buyerIdentitySql;
    const whereSql = this.buildBaseScopeSql(scope);

    return Prisma.sql`
      WITH grouped AS (
        SELECT
          ${identitySql} AS id,
          MIN(NULLIF(BTRIM(${nameColumn}), '')) AS name,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${gatingSql} IS NOT NULL
          AND ${identitySql} IS NOT NULL
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

  private buildBucketExpressionSql(timeGrain: AnalyticsTimeGrain): Prisma.Sql {
    switch (timeGrain) {
      case 'DAY':
        return Prisma.sql`date_trunc('day', record."invoice_date"::date::timestamp)`;
      case 'WEEK':
        return Prisma.sql`date_trunc('week', record."invoice_date"::date::timestamp)`;
      case 'MONTH':
        return Prisma.sql`date_trunc('month', record."invoice_date"::date::timestamp)`;
      case 'QUARTER':
        return Prisma.sql`date_trunc('quarter', record."invoice_date"::date::timestamp)`;
    }
  }

  private buildSeriesStepSql(timeGrain: AnalyticsTimeGrain): Prisma.Sql {
    switch (timeGrain) {
      case 'DAY':
        return Prisma.sql`'1 day'::interval`;
      case 'WEEK':
        return Prisma.sql`'1 week'::interval`;
      case 'MONTH':
        return Prisma.sql`'1 month'::interval`;
      case 'QUARTER':
        return Prisma.sql`'3 months'::interval`;
    }
  }

  private getBucketStartDate(date: Date, timeGrain: AnalyticsTimeGrain): Date {
    const bucketStart = new Date(date);
    bucketStart.setUTCHours(0, 0, 0, 0);

    switch (timeGrain) {
      case 'DAY':
        return bucketStart;
      case 'WEEK': {
        const day = bucketStart.getUTCDay();
        const normalizedDay = day === 0 ? 7 : day;
        bucketStart.setUTCDate(bucketStart.getUTCDate() - (normalizedDay - 1));
        return bucketStart;
      }
      case 'MONTH':
        bucketStart.setUTCDate(1);
        return bucketStart;
      case 'QUARTER': {
        const month = bucketStart.getUTCMonth();
        const quarterStartMonth = Math.floor(month / 3) * 3;
        bucketStart.setUTCMonth(quarterStartMonth, 1);
        return bucketStart;
      }
    }
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

  private buildNormalizedTaxSql(column: string): Prisma.Sql {
    return Prisma.sql`
      NULLIF(
        REGEXP_REPLACE(
          BTRIM(COALESCE(${Prisma.raw(column)}, '')),
          '\s+',
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
          '\s+',
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
          '\s+',
          ' ',
          'g'
        ),
        ''
      )
    `;
  }

  private buildNormalizedUktzedSql(): Prisma.Sql {
    return Prisma.sql`
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          BTRIM(COALESCE(record."uktzed_code", '')),
          '\s+',
          '',
          'g'
        ),
        '\.0+$',
        ''
      )
    `;
  }

  private amountWithVatSql(): Prisma.Sql {
    return Prisma.sql`COALESCE(record."supply_amount_without_vat", 0) + COALESCE(record."vat_amount", 0)`;
  }

  private toMarketEntity(
    row:
      | {
          id: string | null;
          name: string | null;
          amount: Prisma.Decimal | null;
          share: Prisma.Decimal | null;
        }
      | null
      | undefined,
  ): AnalyticsMarketEntity | null {
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
}
