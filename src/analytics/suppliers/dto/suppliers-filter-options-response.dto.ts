import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuppliersFilterOptionItemDto {
  @ApiProperty({ example: '42794130' })
  value: string;

  @ApiPropertyOptional({ example: 'БЕСТ ТЕРРА ОЙЛ', nullable: true })
  label: string | null;
}

export class SuppliersFilterOptionsResponseDto {
  @ApiProperty({ example: 'suppliers' })
  dimension: string;

  @ApiProperty({ type: SuppliersFilterOptionItemDto, isArray: true })
  items: SuppliersFilterOptionItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
