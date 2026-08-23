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
}
