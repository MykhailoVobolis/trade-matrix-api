import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OverviewMetricDto {
  @ApiProperty({ example: 0 })
  current: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previous: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;

  @ApiProperty({ example: false })
  hasComparablePrevious: boolean;
}

export class OverviewPeriodDto {
  @ApiProperty({ example: '2026-01-01' })
  dateFrom: string;

  @ApiProperty({ example: '2026-05-31' })
  dateTo: string;

  @ApiProperty({ example: 'MONTH' })
  timeGrain: string | null;
}

export class OverviewComparisonDto {
  @ApiProperty({ example: 'NONE' })
  mode: string;

  @ApiPropertyOptional({ example: '2025-01-01', nullable: true })
  dateFrom: string | null;

  @ApiPropertyOptional({ example: '2025-05-31', nullable: true })
  dateTo: string | null;
}

export class OverviewTrendPointDto {
  @ApiProperty({ example: '2026-01-01' })
  periodStart: string;

  @ApiProperty({ example: 'Jan 2026' })
  periodLabel: string;

  @ApiProperty({ example: 0 })
  salesWithVat: number;

  @ApiProperty({ example: 0 })
  purchasesWithVat: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  comparisonSalesWithVat: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  comparisonPurchasesWithVat: number | null;
}

export class OverviewRankingItemDto {
  @ApiPropertyOptional({ example: '1234567890', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class OverviewMarketEntityDto {
  @ApiPropertyOptional({ example: '1234567890', nullable: true })
  id: string | null;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ', nullable: true })
  name: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class OverviewMarketRegionDto {
  @ApiPropertyOptional({ example: '10', nullable: true })
  regionCode: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  regionName: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class OverviewMarketUktzedDto {
  @ApiPropertyOptional({ example: '2710', nullable: true })
  code: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  description: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;
}

export class OverviewMarketStructureDto {
  @ApiPropertyOptional({ type: OverviewMarketEntityDto, nullable: true })
  topBuyer: OverviewMarketEntityDto | null;

  @ApiPropertyOptional({ type: OverviewMarketEntityDto, nullable: true })
  topSupplier: OverviewMarketEntityDto | null;

  @ApiPropertyOptional({ type: OverviewMarketRegionDto, nullable: true })
  topBuyerRegion: OverviewMarketRegionDto | null;

  @ApiPropertyOptional({ type: OverviewMarketUktzedDto, nullable: true })
  topUKTZED: OverviewMarketUktzedDto | null;

  @ApiProperty({ example: 0 })
  top5BuyersShare: number;

  @ApiProperty({ example: 0 })
  top5SuppliersShare: number;
}

export class OverviewInsightDto {
  @ApiProperty({ example: 'SALES_CHANGE' })
  type: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown>;
}

export class OverviewResponseDto {
  @ApiProperty({ type: OverviewPeriodDto })
  period: OverviewPeriodDto;

  @ApiProperty({ type: OverviewComparisonDto })
  comparison: OverviewComparisonDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/OverviewMetricDto',
    },
  })
  kpi: Record<string, OverviewMetricDto>;

  @ApiProperty({ type: OverviewTrendPointDto, isArray: true })
  trend: OverviewTrendPointDto[];

  @ApiProperty({ type: OverviewMarketStructureDto })
  marketStructure: OverviewMarketStructureDto;

  @ApiProperty({ type: OverviewRankingItemDto, isArray: true })
  topBuyers: OverviewRankingItemDto[];

  @ApiProperty({ type: OverviewRankingItemDto, isArray: true })
  topSuppliers: OverviewRankingItemDto[];

  @ApiProperty({ type: OverviewRankingItemDto, isArray: true })
  topProducts: OverviewRankingItemDto[];

  @ApiProperty({ type: OverviewRankingItemDto, isArray: true })
  topRegions: OverviewRankingItemDto[];

  @ApiProperty({ type: OverviewInsightDto, isArray: true })
  insights: OverviewInsightDto[];
}
