import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuppliersMetricDto {
  @ApiProperty({ example: 0 })
  current: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previous: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;

  @ApiProperty({ example: false })
  hasComparablePrevious: boolean;
}

export class SuppliersPeriodDto {
  @ApiProperty({ example: '2026-01-01' })
  dateFrom: string;

  @ApiProperty({ example: '2026-12-31' })
  dateTo: string;

  @ApiProperty({ example: 'MONTH' })
  timeGrain: string | null;
}

export class SuppliersComparisonDto {
  @ApiProperty({ example: 'NONE' })
  mode: string;

  @ApiPropertyOptional({ example: '2025-01-01', nullable: true })
  dateFrom: string | null;

  @ApiPropertyOptional({ example: '2025-12-31', nullable: true })
  dateTo: string | null;
}

export class SuppliersTrendPointDto {
  @ApiProperty({ example: '2026-01-01' })
  periodStart: string;

  @ApiProperty({ example: '2026-08' })
  periodLabel: string;

  @ApiProperty({ example: 0 })
  salesWithVat: number;

  @ApiProperty({ example: 0 })
  purchasesWithVat: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  comparisonSalesWithVat: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  comparisonPurchasesWithVat: number | null;
}

export class SuppliersTopEntityItemDto {
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

export class SuppliersTopProductItemDto {
  @ApiPropertyOptional({ example: null, nullable: true })
  productId: string | null;

  @ApiPropertyOptional({ example: 'Літол-24', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: '2710', nullable: true })
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

export class SuppliersTopRegionItemDto {
  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська', nullable: true })
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

export class SuppliersMarketEntityDto {
  @ApiPropertyOptional({ example: '40075815', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class SuppliersMarketRegionDto {
  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська', nullable: true })
  regionName: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class SuppliersMarketUktzedDto {
  @ApiPropertyOptional({ example: '2710', nullable: true })
  code: string | null;

  @ApiPropertyOptional({ example: '2710', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  description: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class SuppliersMarketStructureDto {
  @ApiPropertyOptional({ type: SuppliersMarketEntityDto, nullable: true })
  topBuyer: SuppliersMarketEntityDto | null;

  @ApiPropertyOptional({ type: SuppliersMarketRegionDto, nullable: true })
  topBuyerRegion: SuppliersMarketRegionDto | null;

  @ApiPropertyOptional({ type: SuppliersMarketUktzedDto, nullable: true })
  topUKTZED: SuppliersMarketUktzedDto | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  top5BuyersShare: number | null;
}

export class SuppliersInsightDto {
  @ApiProperty({ example: 'SALES_CHANGE' })
  type: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown>;
}

export class SuppliersResponseDto {
  @ApiProperty({ type: SuppliersPeriodDto })
  period: SuppliersPeriodDto;

  @ApiProperty({ type: SuppliersComparisonDto })
  comparison: SuppliersComparisonDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/SuppliersMetricDto',
    },
  })
  kpi: Record<string, SuppliersMetricDto>;

  @ApiProperty({ type: SuppliersTrendPointDto, isArray: true })
  trend: SuppliersTrendPointDto[];

  @ApiProperty({ type: SuppliersMarketStructureDto })
  marketStructure: SuppliersMarketStructureDto;

  @ApiProperty({ type: SuppliersTopEntityItemDto, isArray: true })
  topBuyers: SuppliersTopEntityItemDto[];

  @ApiProperty({ type: SuppliersTopProductItemDto, isArray: true })
  topProducts: SuppliersTopProductItemDto[];

  @ApiProperty({ type: SuppliersTopRegionItemDto, isArray: true })
  topRegions: SuppliersTopRegionItemDto[];

  @ApiProperty({ type: SuppliersInsightDto, isArray: true })
  insights: SuppliersInsightDto[];
}
