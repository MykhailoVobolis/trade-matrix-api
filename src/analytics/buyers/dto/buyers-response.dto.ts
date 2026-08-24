import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BuyersMetricDto {
  @ApiProperty({ example: 0 })
  current: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previous: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;

  @ApiProperty({ example: false })
  hasComparablePrevious: boolean;
}

export class BuyersPeriodDto {
  @ApiProperty({ example: '2026-01-01' })
  dateFrom: string;

  @ApiProperty({ example: '2026-12-31' })
  dateTo: string;

  @ApiProperty({ example: 'MONTH' })
  timeGrain: string | null;
}

export class BuyersComparisonDto {
  @ApiProperty({ example: 'NONE' })
  mode: string;

  @ApiPropertyOptional({ example: '2025-01-01', nullable: true })
  dateFrom: string | null;

  @ApiPropertyOptional({ example: '2025-12-31', nullable: true })
  dateTo: string | null;
}

export class BuyersTrendPointDto {
  @ApiProperty({ example: '2026-01-01' })
  periodStart: string;

  @ApiProperty({ example: '2026-08' })
  periodLabel: string;

  @ApiProperty({ example: 0 })
  purchasesWithVat: number;

  @ApiProperty({ example: 0 })
  salesWithVat: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  comparisonPurchasesWithVat: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  comparisonSalesWithVat: number | null;
}

export class BuyersTopEntityItemDto {
  @ApiPropertyOptional({ example: '42794130', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'БЕСТ ТЕРРА ОЙЛ', nullable: true })
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

export class BuyersTopProductItemDto {
  @ApiPropertyOptional({ example: 'Літол-24', nullable: true })
  productId: string | null;

  @ApiPropertyOptional({ example: 'Літол-24', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: '2710199900', nullable: true })
  uktzed: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previousAmount: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;
}

export class BuyersTopRegionItemDto {
  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська обл.', nullable: true })
  regionName: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiProperty({ example: 0 })
  activeSuppliers: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previousAmount: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;
}

export class BuyersMarketEntityDto {
  @ApiPropertyOptional({ example: '42794130', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'БЕСТ ТЕРРА ОЙЛ', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class BuyersMarketRegionDto {
  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська обл.', nullable: true })
  regionName: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiProperty({ example: 0 })
  activeSuppliers: number;
}

export class BuyersMarketUktzedDto {
  @ApiPropertyOptional({ example: '2710199900', nullable: true })
  code: string | null;

  @ApiPropertyOptional({ example: '2710199900', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  description: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class BuyersMarketStructureDto {
  @ApiPropertyOptional({ type: BuyersMarketEntityDto, nullable: true })
  topSupplier: BuyersMarketEntityDto | null;

  @ApiPropertyOptional({ type: BuyersMarketRegionDto, nullable: true })
  topSupplierRegion: BuyersMarketRegionDto | null;

  @ApiPropertyOptional({ type: BuyersMarketUktzedDto, nullable: true })
  topUKTZED: BuyersMarketUktzedDto | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5SuppliersShare: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5ProductsShare: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5SupplierRegionsShare: number | null;
}

export class BuyersInsightDto {
  @ApiProperty({ example: 'PURCHASES_CHANGE' })
  type: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown>;
}

export class BuyersResponseDto {
  @ApiProperty({ type: BuyersPeriodDto })
  period: BuyersPeriodDto;

  @ApiProperty({ type: BuyersComparisonDto })
  comparison: BuyersComparisonDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/BuyersMetricDto',
    },
  })
  kpi: Record<string, BuyersMetricDto>;

  @ApiProperty({ type: BuyersTrendPointDto, isArray: true })
  trend: BuyersTrendPointDto[];

  @ApiProperty({ type: BuyersMarketStructureDto })
  marketStructure: BuyersMarketStructureDto;

  @ApiProperty({ type: BuyersTopEntityItemDto, isArray: true })
  topSuppliers: BuyersTopEntityItemDto[];

  @ApiProperty({ type: BuyersTopProductItemDto, isArray: true })
  topProducts: BuyersTopProductItemDto[];

  @ApiProperty({ type: BuyersTopRegionItemDto, isArray: true })
  topSupplierRegions: BuyersTopRegionItemDto[];

  @ApiProperty({ type: BuyersInsightDto, isArray: true })
  insights: BuyersInsightDto[];
}
