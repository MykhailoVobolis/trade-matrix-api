export const BUYERS_ANALYTICS_COMPARISON_MODES = [
  'NONE',
  'PREVIOUS_PERIOD',
  'CUSTOM',
] as const;

export const BUYERS_ANALYTICS_TIME_GRAINS = [
  'MONTH',
  'QUARTER',
  'YEAR',
] as const;

export const BUYERS_ANALYTICS_FILTER_OPTION_DIMENSIONS = [
  'buyers',
  'suppliers',
  'products',
  'uktzed',
  'buyerRegions',
] as const;

export const BUYERS_ANALYTICS_RANKING_DIMENSIONS = [
  'suppliers',
  'products',
  'regions',
] as const;

export const BUYERS_ANALYTICS_TABLE_SORT_FIELDS = [
  'period',
  'buyerRegion',
  'buyer',
  'supplier',
  'product',
  'uktzed',
  'unit',
  'quantity',
  'priceWithVat',
  'purchasesWithVat',
] as const;

export const BUYERS_ANALYTICS_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const BUYERS_ANALYTICS_EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export const BUYERS_ANALYTICS_DEFAULT_TABLE_PAGE = 1;
export const BUYERS_ANALYTICS_DEFAULT_TABLE_LIMIT = 5;
export const BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD = 'period' as const;
export const BUYERS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION = 'desc' as const;
export const BUYERS_ANALYTICS_DEFAULT_RANKINGS_PAGE = 1;
export const BUYERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT = 10;
export const BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE = 1;
export const BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT = 10;
