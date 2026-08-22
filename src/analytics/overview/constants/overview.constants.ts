export const ANALYTICS_COMPARISON_MODES = [
  'NONE',
  'PREVIOUS_PERIOD',
  'CUSTOM',
] as const;

export const ANALYTICS_TIME_GRAINS = [
  'DAY',
  'WEEK',
  'MONTH',
  'QUARTER',
] as const;

export const ANALYTICS_FILTER_OPTION_DIMENSIONS = [
  'buyers',
  'suppliers',
  'products',
  'uktzed',
  'buyerRegions',
] as const;

export const ANALYTICS_TABLE_SORT_FIELDS = [
  'period',
  'buyerRegion',
  'buyer',
  'supplier',
  'product',
  'uktzed',
  'unit',
  'quantity',
  'salesWithVat',
  'purchasesWithVat',
  'marketShare',
] as const;

export const ANALYTICS_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const ANALYTICS_EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export const ANALYTICS_DEFAULT_TABLE_PAGE = 1;
export const ANALYTICS_DEFAULT_TABLE_LIMIT = 10;
export const ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE = 1;
export const ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT = 10;
