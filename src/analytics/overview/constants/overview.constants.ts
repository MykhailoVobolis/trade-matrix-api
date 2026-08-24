export const ANALYTICS_COMPARISON_MODES = [
  'NONE',
  'PREVIOUS_PERIOD',
  'CUSTOM',
] as const;

export const ANALYTICS_TIME_GRAINS = ['MONTH', 'QUARTER', 'YEAR'] as const;

export const ANALYTICS_FILTER_OPTION_DIMENSIONS = [
  'buyers',
  'suppliers',
  'products',
  'uktzed',
  'buyerRegions',
] as const;

export const ANALYTICS_RANKING_DIMENSIONS = [
  'buyers',
  'suppliers',
  'products',
  'regions',
] as const;

export const ANALYTICS_RANKING_SORT_FIELDS = [
  'name',
  'amount',
  'share',
  'uktzed',
  'regionName',
  'activeBuyers',
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
  'priceWithVat',
  'salesWithVat',
] as const;

export const ANALYTICS_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const ANALYTICS_EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export const ANALYTICS_SPECIAL_TAX_IDENTITY_NAMES = {
  '0': ['неплатник'],
} as const;

export const ANALYTICS_REGION_DICTIONARY = {
  '2': 'Вінницька',
  '3': 'Волинська',
  '4': 'Дніпропетровська',
  '5': 'Донецька',
  '6': 'Житомирська',
  '7': 'Закарпатська',
  '8': 'Запорізька',
  '9': 'Івано-Франківська',
  '10': 'Київська',
  '11': 'Кіровоградська',
  '12': 'Луганська',
  '13': 'Львівська',
  '14': 'Миколаївська',
  '15': 'Одеська',
  '16': 'Полтавська',
  '17': 'Рівненська',
  '18': 'Сумська',
  '19': 'Тернопільська',
  '20': 'Харківська',
  '21': 'Херсонська',
  '22': 'Хмельницька',
  '23': 'Черкаська',
  '24': 'Чернівецька',
  '25': 'Чернігівська',
  '26': 'м. Київ',
} as const;

export const ANALYTICS_UNKNOWN_REGION_NAME = 'Не визначено';
export const ANALYTICS_UNKNOWN_REGION_CODE = 'unknown';

export function formatAnalyticsRegionName(
  regionName: string | null,
): string | null {
  if (!regionName) {
    return null;
  }

  if (
    regionName === 'м. Київ' ||
    regionName === ANALYTICS_UNKNOWN_REGION_NAME ||
    regionName.endsWith(' обл.')
  ) {
    return regionName;
  }

  return `${regionName} обл.`;
}

export function normalizeAnalyticsRegionSearchTerm(search: string): string {
  return search
    .replace(/\s*обл\.?$/iu, '')
    .trim()
    .toLowerCase();
}

export const ANALYTICS_DEFAULT_TABLE_PAGE = 1;
export const ANALYTICS_DEFAULT_TABLE_LIMIT = 10;
export const ANALYTICS_DEFAULT_TABLE_SORT_FIELD = 'period' as const;
export const ANALYTICS_DEFAULT_TABLE_SORT_DIRECTION = 'desc' as const;
export const ANALYTICS_DEFAULT_RANKINGS_PAGE = 1;
export const ANALYTICS_DEFAULT_RANKINGS_LIMIT = 10;
export const ANALYTICS_DEFAULT_RANKINGS_SORT_FIELD = 'amount' as const;
export const ANALYTICS_DEFAULT_RANKINGS_SORT_DIRECTION = 'desc' as const;
export const ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE = 1;
export const ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT = 10;
