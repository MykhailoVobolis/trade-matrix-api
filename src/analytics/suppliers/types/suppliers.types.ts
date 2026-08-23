import {
  SUPPLIERS_ANALYTICS_COMPARISON_MODES,
  SUPPLIERS_ANALYTICS_EXPORT_FORMATS,
  SUPPLIERS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
  SUPPLIERS_ANALYTICS_SORT_DIRECTIONS,
  SUPPLIERS_ANALYTICS_TABLE_SORT_FIELDS,
  SUPPLIERS_ANALYTICS_TIME_GRAINS,
} from '../constants/suppliers.constants';

export type SuppliersAnalyticsComparisonMode =
  (typeof SUPPLIERS_ANALYTICS_COMPARISON_MODES)[number];

export type SuppliersAnalyticsTimeGrain =
  (typeof SUPPLIERS_ANALYTICS_TIME_GRAINS)[number];

export type SuppliersAnalyticsFilterOptionDimension =
  (typeof SUPPLIERS_ANALYTICS_FILTER_OPTION_DIMENSIONS)[number];

export type SuppliersAnalyticsTableSortField =
  (typeof SUPPLIERS_ANALYTICS_TABLE_SORT_FIELDS)[number];

export type SuppliersAnalyticsSortDirection =
  (typeof SUPPLIERS_ANALYTICS_SORT_DIRECTIONS)[number];

export type SuppliersAnalyticsExportFormat =
  (typeof SUPPLIERS_ANALYTICS_EXPORT_FORMATS)[number];

export type SuppliersAnalyticsFilterSet = {
  supplierTaxNumbers: string[];
  buyerTaxNumbers: string[];
  buyerRegionCodes: string[];
  uktzedValues: string[];
  products: string[];
};

export type SuppliersAnalyticsDateRange = {
  from: Date;
  to: Date;
};

export type SuppliersAnalyticsBaseScope = {
  userId: string;
  dateRange: SuppliersAnalyticsDateRange;
  filters: SuppliersAnalyticsFilterSet;
};

export type SuppliersAnalyticsKpiTotals = {
  salesWithVat: number;
  activeBuyers: number;
  salesRegions: number;
  productPositions: number;
};

export type SuppliersAnalyticsTrendPoint = {
  periodStart: Date;
  salesWithVat: number;
};

export type SuppliersAnalyticsMarketEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type SuppliersAnalyticsMarketRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
};

export type SuppliersAnalyticsMarketUktzed = {
  code: string | null;
  name: string | null;
  description: string | null;
  amount: number;
  share: number;
};

export type SuppliersAnalyticsMarketStructure = {
  topBuyer: SuppliersAnalyticsMarketEntity | null;
  topBuyerRegion: SuppliersAnalyticsMarketRegion | null;
  topUKTZED: SuppliersAnalyticsMarketUktzed | null;
  top5BuyersShare: number | null;
};

export type SuppliersAnalyticsTopEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type SuppliersAnalyticsTopProduct = {
  productId: string | null;
  name: string | null;
  uktzed: string | null;
  amount: number;
  share: number;
};

export type SuppliersAnalyticsTopRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
  activeBuyers: number;
};

export type SuppliersAnalyticsTableItem = {
  periodStart: Date;
  buyerRegionCode: string | null;
  buyerTaxNumber: string | null;
  buyerName: string | null;
  product: string | null;
  uktzed: string | null;
  unit: string | null;
  quantity: number | null;
  priceWithVat: number | null;
  salesWithVat: number;
  marketShare: number;
};

export type SuppliersAnalyticsTableResult = {
  items: SuppliersAnalyticsTableItem[];
  total: number;
};
