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
