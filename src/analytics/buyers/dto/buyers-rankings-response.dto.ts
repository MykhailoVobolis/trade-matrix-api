import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BuyersRankingItemDto {
  @ApiPropertyOptional({ example: '42794130', nullable: true })
  id?: string | null;

  @ApiPropertyOptional({ example: 'БЕСТ ТЕРРА ОЙЛ', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 'Літол-24', nullable: true })
  productId?: string | null;

  @ApiPropertyOptional({ example: '2710199900', nullable: true })
  uktzed?: string | null;

  @ApiPropertyOptional({ example: '15', nullable: true })
  regionCode?: string | null;

  @ApiPropertyOptional({ example: 'Одеська обл.', nullable: true })
  regionName?: string | null;

  @ApiProperty({ example: 0 })
  amount: number;

  @ApiProperty({ example: 0 })
  share: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  activeSuppliers?: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  previousAmount: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  deltaPercent: number | null;
}

export class BuyersRankingsResponseDto {
  @ApiProperty({ type: BuyersRankingItemDto, isArray: true })
  items: BuyersRankingItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
