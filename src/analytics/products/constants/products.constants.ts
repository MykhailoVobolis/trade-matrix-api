import {
  ANALYTICS_REGION_DICTIONARY,
  ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES,
  ANALYTICS_UNKNOWN_REGION_CODE,
  ANALYTICS_UNKNOWN_REGION_NAME,
  formatAnalyticsRegionName,
  normalizeAnalyticsRegionSearchTerm,
} from '../../overview/constants/overview.constants';

export const PRODUCTS_ANALYTICS_COMPARISON_MODES = [
  'NONE',
  'PREVIOUS_PERIOD',
  'CUSTOM',
] as const;

export const PRODUCTS_ANALYTICS_TIME_GRAINS = [
  'MONTH',
  'QUARTER',
  'YEAR',
] as const;

export const PRODUCTS_ANALYTICS_FILTER_OPTION_DIMENSIONS = [
  'products',
  'uktzed',
  'suppliers',
  'buyers',
  'buyerRegions',
] as const;

export const PRODUCTS_ANALYTICS_RANKING_DIMENSIONS = [
  'buyers',
  'suppliers',
  'regions',
] as const;

export const PRODUCTS_ANALYTICS_TABLE_SORT_FIELDS = [
  'period',
  'buyerRegion',
  'buyer',
  'supplier',
  'product',
  'uktzed',
  'unit',
  'quantity',
  'priceWithVat',
  'salesWithVat',
] as const;

export const PRODUCTS_ANALYTICS_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export const PRODUCTS_ANALYTICS_EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export const PRODUCTS_ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES =
  ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES;
export const PRODUCTS_ANALYTICS_REGION_DICTIONARY = ANALYTICS_REGION_DICTIONARY;
export const PRODUCTS_ANALYTICS_UNKNOWN_REGION_NAME =
  ANALYTICS_UNKNOWN_REGION_NAME;
export const PRODUCTS_ANALYTICS_UNKNOWN_REGION_CODE =
  ANALYTICS_UNKNOWN_REGION_CODE;
export const formatProductsAnalyticsRegionName = formatAnalyticsRegionName;
export const normalizeProductsAnalyticsRegionSearchTerm =
  normalizeAnalyticsRegionSearchTerm;

export const PRODUCTS_ANALYTICS_DEFAULT_TABLE_PAGE = 1;
export const PRODUCTS_ANALYTICS_DEFAULT_TABLE_LIMIT = 5;
export const PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD = 'period' as const;
export const PRODUCTS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION = 'desc' as const;
export const PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_PAGE = 1;
export const PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_LIMIT = 10;
export const PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE = 1;
export const PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT = 10;
