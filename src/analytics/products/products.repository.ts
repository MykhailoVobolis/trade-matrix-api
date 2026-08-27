import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PRODUCTS_ANALYTICS_REGION_DICTIONARY,
  PRODUCTS_ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES,
  PRODUCTS_ANALYTICS_UNKNOWN_REGION_CODE,
  PRODUCTS_ANALYTICS_UNKNOWN_REGION_NAME,
  formatProductsAnalyticsRegionName,
  normalizeProductsAnalyticsRegionSearchTerm,
} from './constants/products.constants';
import { ProductsBaseQueryDto } from './dto/products-base-query.dto';
import type {
  ProductsAnalyticsBaseScope,
  ProductsAnalyticsCompanyIdentity,
  ProductsAnalyticsFilterOptionDimension,
  ProductsAnalyticsKpiTotals,
  ProductsAnalyticsMarketEntity,
  ProductsAnalyticsMarketRegion,
  ProductsAnalyticsMarketStructure,
  ProductsAnalyticsProductsTableItem,
  ProductsAnalyticsProductsTableResult,
  ProductsAnalyticsRankingResult,
  ProductsAnalyticsTimeGrain,
  ProductsAnalyticsTableSortField,
  ProductsAnalyticsTopEntity,
  ProductsAnalyticsTopProduct,
  ProductsAnalyticsTopRegion,
  ProductsAnalyticsTrendPoint,
} from './types/products.types';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  resolveRegionCode(code: string | null | undefined): string | null {
    const normalized = this.normalizeText(code);

    if (!normalized) {
      return null;
    }

    const compact = normalized.replaceAll(' ', '');

    if (!/^\d+$/u.test(compact)) {
      return PRODUCTS_ANALYTICS_UNKNOWN_REGION_CODE;
    }

    const resolved = String(Number(compact));

    return Object.hasOwn(PRODUCTS_ANALYTICS_REGION_DICTIONARY, resolved)
      ? resolved
      : PRODUCTS_ANALYTICS_UNKNOWN_REGION_CODE;
  }

  resolveRegionName(code: string | null | undefined): string | null {
    const regionCode = this.resolveRegionCode(code);

    if (!regionCode) {
      return null;
    }

    return formatProductsAnalyticsRegionName(
      PRODUCTS_ANALYTICS_REGION_DICTIONARY[
        regionCode as keyof typeof PRODUCTS_ANALYTICS_REGION_DICTIONARY
      ] ?? PRODUCTS_ANALYTICS_UNKNOWN_REGION_NAME,
    );
  }

  createBaseScope(
    userId: string,
    query: ProductsBaseQueryDto,
  ): ProductsAnalyticsBaseScope {
    return {
      userId,
      dateRange: {
        from: this.toStartOfDayUtc(query.dateFrom),
        to: this.toEndOfDayUtc(query.dateTo),
      },
      filters: {
        uktzedValues: this.normalizeUktzedValues(query.uktzed),
        normalizedProducts: this.normalizeOutputTextValues(query.products),
        buyerRegionCodes: this.normalizeRegionCodes(query.buyerRegionCodes),
        buyerTaxNumbers: this.normalizeTaxNumbers(query.buyerTaxNumbers),
        supplierTaxNumbers: this.normalizeTaxNumbers(query.supplierTaxNumbers),
      },
    };
  }

  hasSelectedPrimaryFilters(scope: ProductsAnalyticsBaseScope): boolean {
    return (
      scope.filters.normalizedProducts.length > 0 ||
      scope.filters.uktzedValues.length > 0
    );
  }

  buildBaseWhere(
    scope: ProductsAnalyticsBaseScope,
  ): Prisma.RegistryRecordWhereInput {
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

    if (scope.filters.uktzedValues.length > 0) {
      where.OR = scope.filters.uktzedValues.map((value) => ({
        uktzedCode: value,
      }));
    }

    if (scope.filters.normalizedProducts.length > 0) {
      where.itemDescription = {
        in: scope.filters.normalizedProducts,
      };
    }

    return where;
  }

  async getKpiTotals(
    scope: ProductsAnalyticsBaseScope,
  ): Promise<ProductsAnalyticsKpiTotals> {
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
            THEN ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')}
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
    scope: ProductsAnalyticsBaseScope,
    timeGrain: ProductsAnalyticsTimeGrain,
  ): Promise<ProductsAnalyticsTrendPoint[]> {
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
    scope: ProductsAnalyticsBaseScope,
  ): Promise<ProductsAnalyticsMarketStructure> {
    const [
      topBuyer,
      topSupplier,
      topBuyerRegion,
      top5BuyersShare,
      top5SuppliersShare,
      top5RegionsShare,
    ] = await Promise.all([
      this.getTopBuyer(scope),
      this.getTopSupplier(scope),
      this.getTopBuyerRegion(scope),
      this.getTopGroupShare(scope, 5, 'buyer'),
      this.getTopGroupShare(scope, 5, 'supplier'),
      this.getTopGroupShare(scope, 5, 'region'),
    ]);

    return {
      topBuyer,
      topSupplier,
      topBuyerRegion,
      top5BuyersShare,
      top5SuppliersShare,
      top5RegionsShare,
    };
  }

  async getTopBuyers(
    scope: ProductsAnalyticsBaseScope,
    limit = 5,
  ): Promise<ProductsAnalyticsTopEntity[]> {
    return this.getTopEntityList(scope, limit, 'buyer');
  }

  async getTopSuppliers(
    scope: ProductsAnalyticsBaseScope,
    limit = 5,
  ): Promise<ProductsAnalyticsTopEntity[]> {
    return this.getTopEntityList(scope, limit, 'supplier');
  }

  async getTopProducts(
    scope: ProductsAnalyticsBaseScope,
    limit = 5,
  ): Promise<ProductsAnalyticsTopProduct[]> {
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
    scope: ProductsAnalyticsBaseScope,
    limit = 5,
  ): Promise<ProductsAnalyticsTopRegion[]> {
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

  async getBuyerRankings(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
  ): Promise<ProductsAnalyticsRankingResult<ProductsAnalyticsTopEntity>> {
    return this.getEntityRankings(scope, options, 'buyer');
  }

  async getSupplierRankings(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
  ): Promise<ProductsAnalyticsRankingResult<ProductsAnalyticsTopEntity>> {
    return this.getEntityRankings(scope, options, 'supplier');
  }

  async getBuyerRankingComparisonAmounts(
    scope: ProductsAnalyticsBaseScope,
    ids: string[],
  ): Promise<ProductsAnalyticsTopEntity[]> {
    return this.getEntityRankingComparisonAmounts(scope, ids, 'buyer');
  }

  async getSupplierRankingComparisonAmounts(
    scope: ProductsAnalyticsBaseScope,
    ids: string[],
  ): Promise<ProductsAnalyticsTopEntity[]> {
    return this.getEntityRankingComparisonAmounts(scope, ids, 'supplier');
  }

  async getProductRankings(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
  ): Promise<ProductsAnalyticsRankingResult<ProductsAnalyticsTopProduct>> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string | null;
        name: string | null;
        uktzed: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
        totalCount: bigint | number;
      }>
    >(this.buildProductRankingsQuery(scope, options));

    return {
      items: rows.map((row) => ({
        productId: row.productId,
        name: row.name,
        uktzed: row.uktzed,
        amount: Number(row.amount ?? 0),
        share: Number(row.share ?? 0),
      })),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  async getProductRankingComparisonAmounts(
    scope: ProductsAnalyticsBaseScope,
    keys: Array<{ name: string; uktzed: string | null }>,
  ): Promise<ProductsAnalyticsTopProduct[]> {
    if (keys.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string | null;
        name: string | null;
        uktzed: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildProductComparisonAmountsQuery(scope, keys));

    return rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      uktzed: row.uktzed,
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
    }));
  }

  async getRegionRankings(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
  ): Promise<ProductsAnalyticsRankingResult<ProductsAnalyticsTopRegion>> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        regionCode: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
        activeBuyers: bigint | number;
        totalCount: bigint | number;
      }>
    >(this.buildRegionRankingsQuery(scope, options));

    return {
      items: rows.map((row) => ({
        regionCode: this.resolveRegionCode(row.regionCode),
        regionName: this.resolveRegionName(row.regionCode),
        amount: Number(row.amount ?? 0),
        share: Number(row.share ?? 0),
        activeBuyers: Number(row.activeBuyers ?? 0),
      })),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  async getRegionRankingComparisonAmounts(
    scope: ProductsAnalyticsBaseScope,
    regionCodes: string[],
  ): Promise<ProductsAnalyticsTopRegion[]> {
    if (regionCodes.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        regionCode: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
        activeBuyers: bigint | number;
      }>
    >(this.buildRegionComparisonAmountsQuery(scope, regionCodes));

    return rows.map((row) => ({
      regionCode: this.resolveRegionCode(row.regionCode),
      regionName: this.resolveRegionName(row.regionCode),
      amount: Number(row.amount ?? 0),
      share: Number(row.share ?? 0),
      activeBuyers: Number(row.activeBuyers ?? 0),
    }));
  }

  async getFilterOptions(
    scope: ProductsAnalyticsBaseScope,
    dimension: ProductsAnalyticsFilterOptionDimension,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: Array<{ value: string; label: string }>;
    total: number;
  }> {
    switch (dimension) {
      case 'products':
        return this.getProductFilterOptions(scope, options, false, false);
      case 'uktzed':
        return this.getUktzedFilterOptions(scope, options, true, false);
      case 'buyers':
        return this.getEntityFilterOptions(scope, options, 'buyer');
      case 'suppliers':
        return this.getEntityFilterOptions(scope, options, 'supplier');
      case 'buyerRegions':
        return this.getBuyerRegionFilterOptions(scope, options);
    }
  }

  async getProductsTable(
    scope: ProductsAnalyticsBaseScope,
    options: {
      timeGrain: ProductsAnalyticsTimeGrain;
      page: number;
      limit: number;
      sortBy: ProductsAnalyticsTableSortField;
      sortDirection: 'asc' | 'desc';
    },
  ): Promise<ProductsAnalyticsProductsTableResult> {
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
    const orderBySql = this.buildProductsTableOrderBySql(
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
        priceWithVat: Prisma.Decimal | null;
        salesWithVat: Prisma.Decimal | null;
        totalCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${bucketExpressionSql} AS period_start,
          ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS buyer_region_code,
          ${buyerIdentitySql} AS buyer_tax_number,
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(record."buyer_name"), '')) AS buyer_name,
          ${supplierIdentitySql} AS supplier_tax_number,
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(record."seller_name"), '')) AS supplier_name,
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
        SELECT COUNT(*) AS total_count FROM grouped
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
        CASE
          WHEN COALESCE(grouped.quantity, 0) = 0 THEN NULL
          WHEN grouped.sales_with_vat <> 0 THEN grouped.sales_with_vat / grouped.quantity
          WHEN grouped.purchases_with_vat <> 0 THEN grouped.purchases_with_vat / grouped.quantity
          ELSE NULL
        END AS "priceWithVat",
        grouped.sales_with_vat AS "salesWithVat",
        totals.total_count AS "totalCount"
      FROM grouped
      CROSS JOIN totals
      ORDER BY ${orderBySql}
      LIMIT ${options.limit}
      OFFSET ${offset}
    `);

    return {
      items: rows.map((row) => ({
        ...this.mapProductsTableRow(row),
      })),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  async getProductsTableExport(
    scope: ProductsAnalyticsBaseScope,
    options: {
      timeGrain: ProductsAnalyticsTimeGrain;
      sortBy: ProductsAnalyticsTableSortField;
      sortDirection: 'asc' | 'desc';
    },
  ): Promise<ProductsAnalyticsProductsTableItem[]> {
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
    const orderBySql = this.buildProductsTableOrderBySql(
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
        priceWithVat: Prisma.Decimal | null;
        salesWithVat: Prisma.Decimal | null;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${bucketExpressionSql} AS period_start,
          ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS buyer_region_code,
          ${buyerIdentitySql} AS buyer_tax_number,
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(record."buyer_name"), '')) AS buyer_name,
          ${supplierIdentitySql} AS supplier_tax_number,
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(record."seller_name"), '')) AS supplier_name,
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
        SELECT 1
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
        CASE
          WHEN COALESCE(grouped.quantity, 0) = 0 THEN NULL
          WHEN grouped.sales_with_vat <> 0 THEN grouped.sales_with_vat / grouped.quantity
          WHEN grouped.purchases_with_vat <> 0 THEN grouped.purchases_with_vat / grouped.quantity
          ELSE NULL
        END AS "priceWithVat",
        grouped.sales_with_vat AS "salesWithVat"
      FROM grouped
      CROSS JOIN totals
      ORDER BY ${orderBySql}
    `);

    return rows.map((row) => this.mapProductsTableRow(row));
  }

  buildSupplierIdentity(
    taxNumber: string | null,
    name: string | null,
  ): ProductsAnalyticsCompanyIdentity {
    return this.buildCompanyIdentity(taxNumber, name);
  }

  buildBuyerIdentity(
    taxNumber: string | null,
    name: string | null,
  ): ProductsAnalyticsCompanyIdentity {
    return this.buildCompanyIdentity(taxNumber, name);
  }

  private buildCompanyIdentity(
    taxNumber: string | null,
    name: string | null,
  ): ProductsAnalyticsCompanyIdentity {
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

    const semanticNames: readonly string[] | undefined =
      PRODUCTS_ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES[
        normalizedTaxNumber as keyof typeof PRODUCTS_ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES
      ];
    const normalizedSemanticNames = (semanticNames ?? [])
      .map((item) => this.normalizeText(item))
      .filter((item): item is string => item !== null);
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

  private normalizeUktzedValues(values?: string[]): string[] {
    return this.normalizeStringValues(values).map((value) =>
      value.replaceAll(' ', '').replace(/\.0+$/u, ''),
    );
  }

  private normalizeOutputTextValues(values?: string[]): string[] {
    return this.normalizePreservedStringValues(values);
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

  private buildBaseScopeSql(
    scope: ProductsAnalyticsBaseScope,
    options?: {
      includeDateRange?: boolean;
      includeProductsFilter?: boolean;
      includeUktzedFilter?: boolean;
    },
  ): Prisma.Sql {
    const includeDateRange = options?.includeDateRange ?? true;
    const includeProductsFilter = options?.includeProductsFilter ?? true;
    const includeUktzedFilter = options?.includeUktzedFilter ?? true;
    const conditions: Prisma.Sql[] = [
      Prisma.sql`record."userId" = ${scope.userId}`,
      Prisma.sql`record."is_canonical" = TRUE`,
      Prisma.sql`COALESCE(record."is_excluded", FALSE) = FALSE`,
    ];

    if (includeDateRange) {
      conditions.push(
        Prisma.sql`record."invoice_date" >= ${scope.dateRange.from}`,
        Prisma.sql`record."invoice_date" <= ${scope.dateRange.to}`,
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

    if (scope.filters.supplierTaxNumbers.length > 0) {
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

    if (includeUktzedFilter && scope.filters.uktzedValues.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildNormalizedUktzedSql(),
          scope.filters.uktzedValues,
        ),
      );
    }

    if (includeProductsFilter && scope.filters.normalizedProducts.length > 0) {
      conditions.push(
        this.buildSqlEqualsAnyCondition(
          this.buildOutputProductSql(),
          scope.filters.normalizedProducts,
        ),
      );
    }

    return Prisma.join(conditions, ' AND ');
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

  private async getTopBuyer(
    scope: ProductsAnalyticsBaseScope,
  ): Promise<ProductsAnalyticsMarketEntity | null> {
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
    scope: ProductsAnalyticsBaseScope,
    limit: number,
    role: 'buyer' | 'supplier',
  ): Promise<ProductsAnalyticsTopEntity[]> {
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
      .filter((item): item is ProductsAnalyticsTopEntity => item !== null);
  }

  private async getTopSupplier(
    scope: ProductsAnalyticsBaseScope,
  ): Promise<ProductsAnalyticsMarketEntity | null> {
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
    scope: ProductsAnalyticsBaseScope,
  ): Promise<ProductsAnalyticsMarketRegion | null> {
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
        activeBuyers: bigint | number;
      }>
    >(Prisma.sql`
      WITH grouped AS (
        SELECT
          ${this.buildResolvedRegionGroupSql('record."buyer_region_code"')} AS region_code,
          SUM(${amountWithVatSql}) AS amount,
          COUNT(
            DISTINCT ${this.buildCompanyIdentitySql(
              'record."buyer_tax_number"',
              'record."buyer_name"',
            )}
          ) AS active_buyers
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
        END AS share,
        grouped.active_buyers AS "activeBuyers"
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
      activeBuyers: Number(row.activeBuyers ?? 0),
    };
  }

  private async getTopGroupShare(
    scope: ProductsAnalyticsBaseScope,
    limit: number,
    role: 'buyer' | 'supplier' | 'region',
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
    const regionSql = this.buildResolvedRegionGroupSql(
      'record."buyer_region_code"',
    );
    const groupingSql =
      role === 'buyer'
        ? buyerIdentitySql
        : role === 'supplier'
          ? supplierIdentitySql
          : regionSql;
    const gatingSql =
      role === 'buyer'
        ? supplierIdentitySql
        : role === 'supplier'
          ? buyerIdentitySql
          : supplierIdentitySql;
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
          AND ${
            role === 'region'
              ? Prisma.sql`${buyerIdentitySql} IS NOT NULL`
              : Prisma.sql`TRUE`
          }
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
    scope: ProductsAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: Array<{ value: string; label: string }>;
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
                label: this.resolveRegionName(row.regionCode) ?? value,
              }
            : null;
        })
        .filter(
          (
            item,
          ): item is {
            value: string;
            label: string;
          } => item !== null,
        ),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getEntityFilterOptions(
    scope: ProductsAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
    role: 'buyer' | 'supplier',
  ): Promise<{
    items: Array<{ value: string; label: string }>;
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
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(${Prisma.raw(nameColumn)}), '')) AS label
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
                label: row.label ?? row.value,
              }
            : null,
        ),
      ),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getProductFilterOptions(
    scope: ProductsAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
    includeProductsFilter: boolean,
    includeDateRange: boolean,
  ): Promise<{
    items: Array<{ value: string; label: string }>;
    total: number;
  }> {
    const whereSql = this.buildBaseScopeSql(scope, {
      includeProductsFilter,
      includeDateRange,
    });
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
    scope: ProductsAnalyticsBaseScope,
    options: {
      search?: string;
      page: number;
      limit: number;
    },
    includeProductsFilter: boolean,
    includeUktzedFilter: boolean,
  ): Promise<{
    items: Array<{ value: string; label: string }>;
    total: number;
  }> {
    const whereSql = this.buildBaseScopeSql(scope, {
      includeDateRange: false,
      includeProductsFilter,
      includeUktzedFilter,
    });
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

  private buildBuyerRegionSearchSql(search: string | null): Prisma.Sql {
    if (!search) {
      return Prisma.sql`TRUE`;
    }

    const normalizedSearch = normalizeProductsAnalyticsRegionSearchTerm(search);

    const matchingCodes = Object.entries(PRODUCTS_ANALYTICS_REGION_DICTIONARY)
      .filter(([, label]) => label.toLowerCase().includes(normalizedSearch))
      .map(([code]) => code);
    const normalizedSearchPattern = `%${normalizedSearch}%`;

    if (
      PRODUCTS_ANALYTICS_UNKNOWN_REGION_NAME.toLowerCase().includes(
        normalizedSearch,
      )
    ) {
      matchingCodes.push(PRODUCTS_ANALYTICS_UNKNOWN_REGION_CODE);
    }

    if (matchingCodes.length === 0) {
      return Prisma.sql`LOWER(COALESCE(mapped.region_code, '')) LIKE ${normalizedSearchPattern}`;
    }

    return Prisma.sql`(
      LOWER(COALESCE(mapped.region_code, '')) LIKE ${normalizedSearchPattern}
      OR ${this.resolveRegionCodeCaseSql('mapped.region_code')} IN (${Prisma.join(
        matchingCodes,
      )})
    )`;
  }

  private compactFilterOptionItems(
    items: Array<{ value: string; label: string } | null>,
  ): Array<{ value: string; label: string }> {
    return items.filter(
      (
        item,
      ): item is {
        value: string;
        label: string;
      } => item !== null,
    );
  }

  private mapProductsTableRow(row: {
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
    priceWithVat: Prisma.Decimal | null;
    salesWithVat: Prisma.Decimal | null;
  }): ProductsAnalyticsProductsTableItem {
    return {
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
      priceWithVat: row.priceWithVat === null ? null : Number(row.priceWithVat),
      salesWithVat: Number(row.salesWithVat ?? 0),
    };
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

  private buildResolvedRegionGroupSql(column: string): Prisma.Sql {
    const knownCodes = Object.keys(PRODUCTS_ANALYTICS_REGION_DICTIONARY);
    const normalizedCodeSql = this.resolveRegionCodeCaseSql(column);

    return Prisma.sql`
      CASE
        WHEN ${normalizedCodeSql} IS NULL THEN NULL
        WHEN ${normalizedCodeSql} IN (${Prisma.join(knownCodes)}) THEN ${normalizedCodeSql}
        ELSE ${PRODUCTS_ANALYTICS_UNKNOWN_REGION_CODE}
      END
    `;
  }

  private buildProductsTableOrderBySql(
    sortBy: ProductsAnalyticsTableSortField,
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
      case 'priceWithVat':
        return Prisma.sql`"priceWithVat" ${directionSql} NULLS LAST, grouped.period_start DESC`;
      case 'salesWithVat':
        return Prisma.sql`grouped.sales_with_vat ${directionSql}, grouped.period_start DESC`;
    }
  }

  private async getEntityRankings(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
    role: 'buyer' | 'supplier',
  ): Promise<ProductsAnalyticsRankingResult<ProductsAnalyticsTopEntity>> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
        totalCount: bigint | number;
      }>
    >(this.buildEntityRankingsQuery(scope, options, role));

    return {
      items: rows
        .map((row) => this.toMarketEntity(row))
        .filter((item): item is ProductsAnalyticsTopEntity => item !== null),
      total: Number(rows[0]?.totalCount ?? 0),
    };
  }

  private async getEntityRankingComparisonAmounts(
    scope: ProductsAnalyticsBaseScope,
    ids: string[],
    role: 'buyer' | 'supplier',
  ): Promise<ProductsAnalyticsTopEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        name: string | null;
        amount: Prisma.Decimal | null;
        share: Prisma.Decimal | null;
      }>
    >(this.buildEntityComparisonAmountsQuery(scope, ids, role));

    return rows
      .map((row) => this.toMarketEntity(row))
      .filter((item): item is ProductsAnalyticsTopEntity => item !== null);
  }

  private buildEntityRankingsQuery(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
    role: 'buyer' | 'supplier',
  ): Prisma.Sql {
    const offset = (options.page - 1) * options.limit;
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
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(${nameColumn}), '')) AS name,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${gatingSql} IS NOT NULL
          AND ${identitySql} IS NOT NULL
        GROUP BY 1
      ),
      totals AS (
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(amount), 0) AS total_amount
        FROM grouped
      )
      SELECT
        grouped.id AS id,
        grouped.name AS name,
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share,
        totals.total_count AS "totalCount"
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.id ASC
      LIMIT ${options.limit}
      OFFSET ${offset}
    `;
  }

  private buildEntityComparisonAmountsQuery(
    scope: ProductsAnalyticsBaseScope,
    ids: string[],
    role: 'buyer' | 'supplier',
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
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(${nameColumn}), '')) AS name,
          SUM(${amountWithVatSql}) AS amount
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${gatingSql} IS NOT NULL
          AND ${identitySql} IS NOT NULL
          AND ${this.buildSqlEqualsAnyCondition(identitySql, ids)}
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
    `;
  }

  private buildProductRankingsQuery(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
  ): Prisma.Sql {
    const offset = (options.page - 1) * options.limit;
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const outputProductSql = this.buildOutputProductSql();
    const outputUktzedSql = this.buildOutputUktzedSql();
    const amountWithVatSql = this.amountWithVatSql();
    const whereSql = this.buildBaseScopeSql(scope);

    return Prisma.sql`
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
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(amount), 0) AS total_amount
        FROM grouped
      )
      SELECT
        grouped.product_id AS "productId",
        grouped.name AS name,
        grouped.uktzed AS uktzed,
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share,
        totals.total_count AS "totalCount"
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.name ASC NULLS LAST
      LIMIT ${options.limit}
      OFFSET ${offset}
    `;
  }

  private buildProductComparisonAmountsQuery(
    scope: ProductsAnalyticsBaseScope,
    keys: Array<{ name: string; uktzed: string | null }>,
  ): Prisma.Sql {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const outputProductSql = this.buildOutputProductSql();
    const outputUktzedSql = this.buildOutputUktzedSql();
    const amountWithVatSql = this.amountWithVatSql();
    const whereSql = this.buildBaseScopeSql(scope);
    const keyConditions = keys.map((key) =>
      key.uktzed === null
        ? Prisma.sql`
            (
              NULLIF(${outputProductSql}, '') = ${key.name}
              AND NULLIF(${outputUktzedSql}, '') IS NULL
            )
          `
        : Prisma.sql`
            (
              NULLIF(${outputProductSql}, '') = ${key.name}
              AND NULLIF(${outputUktzedSql}, '') = ${key.uktzed}
            )
          `,
    );

    return Prisma.sql`
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
          AND (${Prisma.join(keyConditions, ' OR ')})
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
    `;
  }

  private buildRegionRankingsQuery(
    scope: ProductsAnalyticsBaseScope,
    options: { page: number; limit: number },
  ): Prisma.Sql {
    const offset = (options.page - 1) * options.limit;
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const amountWithVatSql = this.amountWithVatSql();
    const regionSql = this.buildResolvedRegionGroupSql(
      'record."buyer_region_code"',
    );
    const whereSql = this.buildBaseScopeSql(scope);

    return Prisma.sql`
      WITH grouped AS (
        SELECT
          ${regionSql} AS region_code,
          SUM(${amountWithVatSql}) AS amount,
          COUNT(DISTINCT ${buyerIdentitySql}) AS active_buyers
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${buyerIdentitySql} IS NOT NULL
          AND ${regionSql} IS NOT NULL
        GROUP BY 1
      ),
      totals AS (
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(amount), 0) AS total_amount
        FROM grouped
      )
      SELECT
        grouped.region_code AS "regionCode",
        grouped.amount AS amount,
        CASE
          WHEN totals.total_amount = 0 THEN 0
          ELSE grouped.amount / totals.total_amount * 100
        END AS share,
        grouped.active_buyers AS "activeBuyers",
        totals.total_count AS "totalCount"
      FROM grouped
      CROSS JOIN totals
      ORDER BY grouped.amount DESC, grouped.region_code ASC
      LIMIT ${options.limit}
      OFFSET ${offset}
    `;
  }

  private buildRegionComparisonAmountsQuery(
    scope: ProductsAnalyticsBaseScope,
    regionCodes: string[],
  ): Prisma.Sql {
    const supplierIdentitySql = this.buildCompanyIdentitySql(
      'record."seller_tax_number"',
      'record."seller_name"',
    );
    const buyerIdentitySql = this.buildCompanyIdentitySql(
      'record."buyer_tax_number"',
      'record."buyer_name"',
    );
    const amountWithVatSql = this.amountWithVatSql();
    const regionSql = this.buildResolvedRegionGroupSql(
      'record."buyer_region_code"',
    );
    const whereSql = this.buildBaseScopeSql(scope);

    return Prisma.sql`
      WITH grouped AS (
        SELECT
          ${regionSql} AS region_code,
          SUM(${amountWithVatSql}) AS amount,
          COUNT(DISTINCT ${buyerIdentitySql}) AS active_buyers
        FROM "RegistryRecord" AS record
        WHERE ${whereSql}
          AND ${supplierIdentitySql} IS NOT NULL
          AND ${buyerIdentitySql} IS NOT NULL
          AND ${regionSql} IS NOT NULL
          AND ${this.buildSqlEqualsAnyCondition(regionSql, regionCodes)}
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
    `;
  }

  private buildTopEntityQuery(
    scope: ProductsAnalyticsBaseScope,
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
          MODE() WITHIN GROUP (ORDER BY NULLIF(BTRIM(${nameColumn}), '')) AS name,
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

  private buildBucketExpressionSql(
    timeGrain: ProductsAnalyticsTimeGrain,
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
    timeGrain: ProductsAnalyticsTimeGrain,
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
    timeGrain: ProductsAnalyticsTimeGrain,
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
  ): ProductsAnalyticsMarketEntity | null {
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
