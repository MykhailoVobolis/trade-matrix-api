import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES } from './constants/overview.constants';
import { OverviewBaseQueryDto } from './dto/overview-base-query.dto';
import type {
  AnalyticsBaseScope,
  AnalyticsCompanyIdentity,
  AnalyticsKpiTotals,
  AnalyticsMarketEntity,
  AnalyticsMarketRegion,
  AnalyticsMarketStructure,
  AnalyticsMarketUktzed,
  AnalyticsTimeGrain,
  AnalyticsTrendPoint,
} from './types/overview.types';

@Injectable()
export class OverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

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
        buyerRegionCodes: this.normalizeStringValues(query.buyerRegionCodes),
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
      regionCode: row.regionCode,
      regionName: null,
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

  private buildTopEntityQuery(
    scope: AnalyticsBaseScope,
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
      LIMIT 1
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
