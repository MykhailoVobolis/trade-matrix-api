import {
  BUYERS_ANALYTICS_COMPARISON_MODES,
  BUYERS_ANALYTICS_EXPORT_FORMATS,
  BUYERS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
  BUYERS_ANALYTICS_RANKING_DIMENSIONS,
  BUYERS_ANALYTICS_SORT_DIRECTIONS,
  BUYERS_ANALYTICS_TABLE_SORT_FIELDS,
  BUYERS_ANALYTICS_TIME_GRAINS,
} from '../constants/buyers.constants';

export type BuyersAnalyticsComparisonMode =
  (typeof BUYERS_ANALYTICS_COMPARISON_MODES)[number];

export type BuyersAnalyticsTimeGrain =
  (typeof BUYERS_ANALYTICS_TIME_GRAINS)[number];

export type BuyersAnalyticsFilterOptionDimension =
  (typeof BUYERS_ANALYTICS_FILTER_OPTION_DIMENSIONS)[number];

export type BuyersAnalyticsRankingDimension =
  (typeof BUYERS_ANALYTICS_RANKING_DIMENSIONS)[number];

export type BuyersAnalyticsTableSortField =
  (typeof BUYERS_ANALYTICS_TABLE_SORT_FIELDS)[number];

export type BuyersAnalyticsSortDirection =
  (typeof BUYERS_ANALYTICS_SORT_DIRECTIONS)[number];

export type BuyersAnalyticsExportFormat =
  (typeof BUYERS_ANALYTICS_EXPORT_FORMATS)[number];

export type BuyersAnalyticsFilterSet = {
  buyerTaxNumbers: string[];
  supplierTaxNumbers: string[];
  buyerRegionCodes: string[];
  uktzedValues: string[];
  products: string[];
};

export type BuyersAnalyticsDateRange = {
  from: Date;
  to: Date;
};

export type BuyersAnalyticsBaseScope = {
  userId: string;
  dateRange: BuyersAnalyticsDateRange;
  filters: BuyersAnalyticsFilterSet;
};

export type BuyersAnalyticsKpiTotals = {
  purchasesWithVat: number;
  activeSuppliers: number;
  buyerRegions: number;
  productPositions: number;
};

export type BuyersAnalyticsTrendPoint = {
  periodStart: Date;
  purchasesWithVat: number;
};

export type BuyersAnalyticsMarketEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type BuyersAnalyticsMarketRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
  activeSuppliers: number;
};

export type BuyersAnalyticsMarketUktzed = {
  code: string | null;
  name: string | null;
  description: string | null;
  amount: number;
  share: number;
};

export type BuyersAnalyticsMarketStructure = {
  topSupplier: BuyersAnalyticsMarketEntity | null;
  topBuyerRegion: BuyersAnalyticsMarketRegion | null;
  topUKTZED: BuyersAnalyticsMarketUktzed | null;
  top5SuppliersShare: number | null;
};

export type BuyersAnalyticsTopEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type BuyersAnalyticsTopProduct = {
  productId: string | null;
  name: string | null;
  uktzed: string | null;
  amount: number;
  share: number;
};

export type BuyersAnalyticsTopRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
  activeSuppliers: number;
};

export type BuyersAnalyticsTableItem = {
  periodStart: Date;
  buyerRegionCode: string | null;
  buyerTaxNumber: string | null;
  buyerName: string | null;
  supplierTaxNumber: string | null;
  supplierName: string | null;
  product: string | null;
  uktzed: string | null;
  unit: string | null;
  quantity: number | null;
  priceWithVat: number | null;
  purchasesWithVat: number;
};

export type BuyersAnalyticsTableResult = {
  items: BuyersAnalyticsTableItem[];
  total: number;
};

export type BuyersAnalyticsRankingResult<TItem> = {
  items: TItem[];
  total: number;
};
