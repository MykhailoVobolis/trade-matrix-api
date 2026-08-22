import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OverviewTableItemDto {
  @ApiProperty({ example: '2026-01' })
  period: string;

  @ApiPropertyOptional({ example: '10', nullable: true })
  buyerRegionCode: string | null;

  @ApiPropertyOptional({ example: 'Київська', nullable: true })
  buyerRegionName: string | null;

  @ApiPropertyOptional({ example: '40075815', nullable: true })
  buyerTaxNumber: string | null;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ', nullable: true })
  buyerName: string | null;

  @ApiPropertyOptional({ example: '42794130', nullable: true })
  supplierTaxNumber: string | null;

  @ApiPropertyOptional({ example: 'БЕСТ ТЕРРА ОЙЛ', nullable: true })
  supplierName: string | null;

  @ApiPropertyOptional({ example: 'Літол-24', nullable: true })
  product: string | null;

  @ApiPropertyOptional({ example: '2710', nullable: true })
  uktzed: string | null;

  @ApiPropertyOptional({ example: 'кг', nullable: true })
  unit: string | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  quantity: number | null;

  @ApiProperty({ example: 0 })
  salesWithVat: number;

  @ApiProperty({ example: 0 })
  purchasesWithVat: number;

  @ApiProperty({ example: 0 })
  marketShare: number;
}

export class OverviewTableResponseDto {
  @ApiProperty({ type: OverviewTableItemDto, isArray: true })
  items: OverviewTableItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
