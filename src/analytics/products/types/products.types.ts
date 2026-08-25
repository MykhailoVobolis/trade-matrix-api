import {
  PRODUCTS_ANALYTICS_COMPARISON_MODES,
  PRODUCTS_ANALYTICS_EXPORT_FORMATS,
  PRODUCTS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
  PRODUCTS_ANALYTICS_RANKING_DIMENSIONS,
  PRODUCTS_ANALYTICS_SORT_DIRECTIONS,
  PRODUCTS_ANALYTICS_TABLE_SORT_FIELDS,
  PRODUCTS_ANALYTICS_TIME_GRAINS,
} from '../constants/products.constants';

export type ProductsAnalyticsComparisonMode =
  (typeof PRODUCTS_ANALYTICS_COMPARISON_MODES)[number];

export type ProductsAnalyticsTimeGrain =
  (typeof PRODUCTS_ANALYTICS_TIME_GRAINS)[number];

export type ProductsAnalyticsFilterOptionDimension =
  (typeof PRODUCTS_ANALYTICS_FILTER_OPTION_DIMENSIONS)[number];

export type ProductsAnalyticsRankingDimension =
  (typeof PRODUCTS_ANALYTICS_RANKING_DIMENSIONS)[number];

export type ProductsAnalyticsTableSortField =
  (typeof PRODUCTS_ANALYTICS_TABLE_SORT_FIELDS)[number];

export type ProductsAnalyticsSortDirection =
  (typeof PRODUCTS_ANALYTICS_SORT_DIRECTIONS)[number];
export type ProductsAnalyticsExportFormat =
  (typeof PRODUCTS_ANALYTICS_EXPORT_FORMATS)[number];

export type ProductsAnalyticsCompanyIdentity = {
  taxNumber: string | null;
  normalizedName: string | null;
  identityKey: string | null;
  isSemanticSpecialIdentity: boolean;
};

export type ProductsAnalyticsFilterSet = {
  uktzedValues: string[];
  normalizedProducts: string[];
  buyerRegionCodes: string[];
  buyerTaxNumbers: string[];
  supplierTaxNumbers: string[];
};

export type ProductsAnalyticsDateRange = {
  from: Date;
  to: Date;
};

export type ProductsAnalyticsBaseScope = {
  userId: string;
  dateRange: ProductsAnalyticsDateRange;
  filters: ProductsAnalyticsFilterSet;
};

export type ProductsAnalyticsKpiTotals = {
  salesWithVat: number;
  purchasesWithVat: number;
  activeBuyers: number;
  activeSuppliers: number;
  salesRegions: number;
};

export type ProductsAnalyticsTrendPoint = {
  periodStart: Date;
  salesWithVat: number;
  purchasesWithVat: number;
};

export type ProductsAnalyticsMarketEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type ProductsAnalyticsMarketRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
  activeBuyers: number;
};

export type ProductsAnalyticsMarketUktzed = {
  code: string | null;
  description: string | null;
  amount: number;
  share: number;
};

export type ProductsAnalyticsMarketStructure = {
  topBuyer: ProductsAnalyticsMarketEntity | null;
  topSupplier: ProductsAnalyticsMarketEntity | null;
  topBuyerRegion: ProductsAnalyticsMarketRegion | null;
  top5BuyersShare: number;
  top5SuppliersShare: number;
  top5RegionsShare: number;
};

export type ProductsAnalyticsTopEntity = {
  id: string | null;
  name: string | null;
  amount: number;
  share: number;
};

export type ProductsAnalyticsTopProduct = {
  productId: string | null;
  name: string | null;
  uktzed: string | null;
  amount: number;
  share: number;
};

export type ProductsAnalyticsTopRegion = {
  regionCode: string | null;
  regionName: string | null;
  amount: number;
  share: number;
  activeBuyers: number;
};

export type ProductsAnalyticsTableItem = {
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
  salesWithVat: number;
};

export type ProductsAnalyticsTableResult = {
  items: ProductsAnalyticsTableItem[];
  total: number;
};

export type ProductsAnalyticsProductsTableItem = ProductsAnalyticsTableItem;
export type ProductsAnalyticsProductsTableResult = ProductsAnalyticsTableResult;

export type ProductsAnalyticsRankingResult<TItem> = {
  items: TItem[];
  total: number;
};
