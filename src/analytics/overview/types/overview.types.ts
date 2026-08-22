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
