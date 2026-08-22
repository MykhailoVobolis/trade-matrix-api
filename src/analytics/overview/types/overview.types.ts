import {
  ANALYTICS_COMPARISON_MODES,
  ANALYTICS_EXPORT_FORMATS,
  ANALYTICS_FILTER_OPTION_DIMENSIONS,
  ANALYTICS_SORT_DIRECTIONS,
  ANALYTICS_TABLE_SORT_FIELDS,
  ANALYTICS_TIME_GRAINS,
} from '../constants/overview.constants';

export type AnalyticsComparisonMode =
  (typeof ANALYTICS_COMPARISON_MODES)[number];

export type AnalyticsTimeGrain = (typeof ANALYTICS_TIME_GRAINS)[number];

export type AnalyticsFilterOptionDimension =
  (typeof ANALYTICS_FILTER_OPTION_DIMENSIONS)[number];

export type AnalyticsTableSortField =
  (typeof ANALYTICS_TABLE_SORT_FIELDS)[number];

export type AnalyticsSortDirection = (typeof ANALYTICS_SORT_DIRECTIONS)[number];
export type AnalyticsExportFormat = (typeof ANALYTICS_EXPORT_FORMATS)[number];

export type AnalyticsCompanyIdentity = {
  taxNumber: string | null;
  normalizedName: string | null;
  identityKey: string | null;
  isSemanticSpecialIdentity: boolean;
};

export type AnalyticsFilterSet = {
  uktzedPrefixes: string[];
  normalizedProducts: string[];
  buyerRegionCodes: string[];
  buyerTaxNumbers: string[];
  supplierTaxNumbers: string[];
};

export type AnalyticsDateRange = {
  from: Date;
  to: Date;
};

export type AnalyticsBaseScope = {
  userId: string;
  dateRange: AnalyticsDateRange;
  filters: AnalyticsFilterSet;
};

export type AnalyticsKpiTotals = {
  salesWithVat: number;
  purchasesWithVat: number;
  activeBuyers: number;
  activeSuppliers: number;
  salesRegions: number;
};

export type AnalyticsTrendPoint = {
  periodStart: Date;
  salesWithVat: number;
  purchasesWithVat: number;
};

export type AnalyticsMarketEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type AnalyticsMarketRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
};

export type AnalyticsMarketUktzed = {
  code: string | null;
  description: string | null;
  amount: number;
  share: number;
};

export type AnalyticsMarketStructure = {
  topBuyer: AnalyticsMarketEntity | null;
  topSupplier: AnalyticsMarketEntity | null;
  topBuyerRegion: AnalyticsMarketRegion | null;
  topUKTZED: AnalyticsMarketUktzed | null;
  top5BuyersShare: number;
  top5SuppliersShare: number;
};

export type AnalyticsTopEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type AnalyticsTopProduct = {
  productId: string | null;
  name: string | null;
  uktzed: string | null;
  amount: number;
  share: number;
};

export type AnalyticsTopRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
  activeBuyers: number;
};
