export const REGISTRY_IMPORT_MAX_FILES = 20;
export const REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type RegistryRecordField =
  | 'sellerRegionCode'
  | 'sellerDistrictCode'
  | 'sellerTaxNumber'
  | 'sellerIpn'
  | 'sellerName'
  | 'sellerStatus'
  | 'buyerRegionCode'
  | 'buyerDistrictCode'
  | 'buyerTaxNumber'
  | 'buyerIpn'
  | 'buyerName'
  | 'buyerStatus'
  | 'registrationNumber'
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'registrationDate'
  | 'erpnStatus'
  | 'isExcluded'
  | 'totalAmountPayable'
  | 'totalVatAmount'
  | 'supplyAmount20'
  | 'supplyAmount14'
  | 'supplyAmount7'
  | 'adjustmentCount'
  | 'adjustmentAmount'
  | 'unitPriceDeclared'
  | 'itemDescription'
  | 'uktzedCode'
  | 'dkppCode'
  | 'unitName'
  | 'quantity'
  | 'unitPriceActual'
  | 'supplyAmountWithoutVat'
  | 'vatAmount';

export type RegistryImportColumnSpec = {
  field: RegistryRecordField;
  header: string;
  occurrence: number;
};

export const REGISTRY_IMPORT_COLUMN_SPECS: RegistryImportColumnSpec[] = [
  {
    field: 'sellerRegionCode',
    header: 'Область (Продавець)',
    occurrence: 1,
  },
  { field: 'sellerDistrictCode', header: 'Район (Продавець)', occurrence: 1 },
  {
    field: 'sellerTaxNumber',
    header: 'Податковий № (Продавець)',
    occurrence: 1,
  },
  { field: 'sellerIpn', header: 'ІПН (Продавець)', occurrence: 1 },
  {
    field: 'sellerName',
    header: 'Найменування/ПІБ (Продавець)',
    occurrence: 1,
  },
  { field: 'sellerStatus', header: 'Стан (Продавець)', occurrence: 1 },
  { field: 'buyerRegionCode', header: 'Область (Покупець)', occurrence: 1 },
  { field: 'buyerDistrictCode', header: 'Район (Покупець)', occurrence: 1 },
  {
    field: 'buyerTaxNumber',
    header: 'Податковий № (Покупець)',
    occurrence: 1,
  },
  { field: 'buyerIpn', header: 'ІПН (Покупець)', occurrence: 1 },
  {
    field: 'buyerName',
    header: 'Найменування/ПІБ (Покупець)',
    occurrence: 1,
  },
  { field: 'buyerStatus', header: 'Стан (Покупець)', occurrence: 1 },
  { field: 'registrationNumber', header: 'Реєстраційний №', occurrence: 1 },
  { field: 'invoiceNumber', header: 'Номер ПН/РК', occurrence: 1 },
  { field: 'invoiceDate', header: 'Дата виписки', occurrence: 1 },
  { field: 'registrationDate', header: 'Дата реєстрації', occurrence: 1 },
  { field: 'erpnStatus', header: 'Статус в ЄРПН', occurrence: 1 },
  { field: 'isExcluded', header: 'Виключено', occurrence: 1 },
  {
    field: 'totalAmountPayable',
    header: 'Загальна сума коштів що підлягає сплаті',
    occurrence: 1,
  },
  { field: 'totalVatAmount', header: 'Загальна сума ПДВ', occurrence: 1 },
  {
    field: 'supplyAmount20',
    header: 'Обсяг операцій за ставкою 20%',
    occurrence: 1,
  },
  {
    field: 'supplyAmount14',
    header: 'Обсяг операцій за ставкою 14%',
    occurrence: 1,
  },
  {
    field: 'supplyAmount7',
    header: 'Обсяг операцій за ставкою 7%',
    occurrence: 1,
  },
  { field: 'adjustmentCount', header: 'Кількість РК', occurrence: 1 },
  { field: 'adjustmentAmount', header: 'Сума коригування', occurrence: 1 },
  {
    field: 'unitPriceDeclared',
    header: 'Ціна постачання одиниці товару/послуги без ПДВ',
    occurrence: 1,
  },
  {
    field: 'itemDescription',
    header: 'Номенклатура товарів/послуг',
    occurrence: 1,
  },
  { field: 'uktzedCode', header: 'Код УКТЗЕД', occurrence: 1 },
  { field: 'dkppCode', header: 'Код ДКПП', occurrence: 1 },
  {
    field: 'unitName',
    header: 'Одиниця виміру товару/ послуги',
    occurrence: 1,
  },
  { field: 'quantity', header: 'Кількість (об’єм, обсяг)', occurrence: 1 },
  {
    field: 'unitPriceActual',
    header: 'Ціна постачання одиниці товару/послуги без ПДВ',
    occurrence: 2,
  },
  {
    field: 'supplyAmountWithoutVat',
    header: 'Обсяги постачання без ПДВ',
    occurrence: 1,
  },
  { field: 'vatAmount', header: 'Сума ПДВ', occurrence: 1 },
];

export const REGISTRY_IMPORT_REQUIRED_HEADERS =
  REGISTRY_IMPORT_COLUMN_SPECS.map((column) => column.header);
