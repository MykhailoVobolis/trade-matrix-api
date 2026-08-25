import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BuyersTableItemDto {
  @ApiProperty({ example: '2026-08' })
  period: string;

  @ApiPropertyOptional({ example: '15', nullable: true })
  buyerRegionCode: string | null;

  @ApiPropertyOptional({ example: 'Одеська обл.', nullable: true })
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

  @ApiPropertyOptional({ example: 0, nullable: true })
  priceWithVat: number | null;

  @ApiProperty({ example: 0 })
  purchasesWithVat: number;
}

export class BuyersTableResponseDto {
  @ApiProperty({ type: BuyersTableItemDto, isArray: true })
  items: BuyersTableItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 5 })
  limit: number;
}
