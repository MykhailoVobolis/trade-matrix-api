import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductsMetricDto {
  @ApiProperty({ example: 0 })
  current: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previous: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;

  @ApiProperty({ example: false })
  hasComparablePrevious: boolean;
}

export class ProductsPeriodDto {
  @ApiProperty({ example: '2025-01-01' })
  dateFrom: string;

  @ApiProperty({ example: '2025-12-31' })
  dateTo: string;

  @ApiProperty({ example: 'MONTH' })
  timeGrain: string | null;
}

export class ProductsComparisonDto {
  @ApiProperty({ example: 'PREVIOUS_PERIOD' })
  mode: string;

  @ApiPropertyOptional({ example: '2024-01-01', nullable: true })
  dateFrom: string | null;

  @ApiPropertyOptional({ example: '2024-12-31', nullable: true })
  dateTo: string | null;
}

export class ProductsTrendPointDto {
  @ApiProperty({ example: '2025-01-01' })
  periodStart: string;

  @ApiProperty({ example: '2025-01' })
  periodLabel: string;

  @ApiProperty({ example: 0 })
  salesWithVat: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  comparisonSalesWithVat: number | null;
}

export class ProductsTopEntityItemDto {
  @ApiPropertyOptional({ example: '40075815', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previousAmount: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;
}

export class ProductsTopRegionItemDto {
  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська обл.', nullable: true })
  regionName: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiProperty({ example: 0 })
  activeBuyers: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previousAmount: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;
}

export class ProductsMarketEntityDto {
  @ApiPropertyOptional({ example: '42794130', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'БЕСТ ТЕРРА ОЙЛ', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class ProductsMarketRegionDto {
  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська обл.', nullable: true })
  regionName: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiProperty({ example: 0 })
  activeBuyers: number;
}

export class ProductsMarketStructureDto {
  @ApiPropertyOptional({ type: ProductsMarketEntityDto, nullable: true })
  topSupplier: ProductsMarketEntityDto | null;

  @ApiPropertyOptional({ type: ProductsMarketEntityDto, nullable: true })
  topBuyer: ProductsMarketEntityDto | null;

  @ApiPropertyOptional({ type: ProductsMarketRegionDto, nullable: true })
  topBuyerRegion: ProductsMarketRegionDto | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5SuppliersShare: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5BuyersShare: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5RegionsShare: number | null;
}

export class ProductsInsightDto {
  @ApiProperty({ example: 'SALES_CHANGE' })
  type: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown>;
}

export class ProductsResponseDto {
  @ApiProperty({ type: ProductsPeriodDto })
  period: ProductsPeriodDto;

  @ApiProperty({ type: ProductsComparisonDto })
  comparison: ProductsComparisonDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/ProductsMetricDto',
    },
  })
  kpi: Record<string, ProductsMetricDto>;

  @ApiProperty({ type: ProductsTrendPointDto, isArray: true })
  trend: ProductsTrendPointDto[];

  @ApiProperty({ type: ProductsMarketStructureDto })
  marketStructure: ProductsMarketStructureDto;

  @ApiProperty({ type: ProductsTopEntityItemDto, isArray: true })
  topBuyers: ProductsTopEntityItemDto[];

  @ApiProperty({ type: ProductsTopEntityItemDto, isArray: true })
  topSuppliers: ProductsTopEntityItemDto[];

  @ApiProperty({ type: ProductsTopRegionItemDto, isArray: true })
  topRegions: ProductsTopRegionItemDto[];

  @ApiProperty({ type: ProductsInsightDto, isArray: true })
  insights: ProductsInsightDto[];
}
