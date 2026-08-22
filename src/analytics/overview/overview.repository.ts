import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES } from './constants/overview.constants';
import { OverviewBaseQueryDto } from './dto/overview-base-query.dto';
import type {
  AnalyticsBaseScope,
  AnalyticsCompanyIdentity,
} from './types/overview.types';

@Injectable()
export class OverviewRepository {
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
}
