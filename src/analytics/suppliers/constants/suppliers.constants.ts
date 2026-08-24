export const SUPPLIERS_ANALYTICS_COMPARISON_MODES = [
  'NONE',
  'PREVIOUS_PERIOD',
  'CUSTOM',
] as const;

export const SUPPLIERS_ANALYTICS_TIME_GRAINS = [
  'MONTH',
  'QUARTER',
  'YEAR',
] as const;

export const SUPPLIERS_ANALYTICS_FILTER_OPTION_DIMENSIONS = [
  'suppliers',
  'buyers',
  'products',
  'uktzed',
  'buyerRegions',
] as const;

export const SUPPLIERS_ANALYTICS_TABLE_SORT_FIELDS = [
  'period',
  'buyerRegion',
  'buyer',
  'product',
  'uktzed',
  'unit',
  'quantity',
  'priceWithVat',
  'salesWithVat',
] as const;

export const SUPPLIERS_ANALYTICS_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const SUPPLIERS_ANALYTICS_EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export const SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE = 1;
export const SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT = 5;
export const SUPPLIERS_ANALYTICS_DEFAULT_TABLE_SORT_FIELD = 'period' as const;
export const SUPPLIERS_ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION = 'desc' as const;
export const SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE = 1;
export const SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT = 10;
