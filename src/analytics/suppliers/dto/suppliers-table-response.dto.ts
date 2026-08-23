import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuppliersTableItemDto {
  @ApiProperty({ example: '2026-08' })
  period: string;

  @ApiPropertyOptional({ example: '15', nullable: true })
  buyerRegionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська', nullable: true })
  buyerRegionName: string | null;

  @ApiPropertyOptional({ example: '12345678', nullable: true })
  buyerTaxNumber: string | null;

  @ApiPropertyOptional({ example: 'ТОВ Приклад', nullable: true })
  buyerName: string | null;

  @ApiPropertyOptional({ example: 'Літол-24', nullable: true })
  product: string | null;

  @ApiPropertyOptional({ example: '2710', nullable: true })
  uktzed: string | null;

  @ApiPropertyOptional({ example: 'кг', nullable: true })
  unit: string | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  quantity: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  priceWithVat: number | null;

  @ApiProperty({ example: 0 })
  salesWithVat: number;

  @ApiProperty({ example: 0 })
  marketShare: number;
}

export class SuppliersTableResponseDto {
  @ApiProperty({ type: SuppliersTableItemDto, isArray: true })
  items: SuppliersTableItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 5 })
  limit: number;
}
