import { ApiProperty } from '@nestjs/swagger';

export class FilterOptionItemDto {
  @ApiProperty({ example: '42794130' })
  value: string;

  @ApiProperty({ example: 'МЕГАРОСТ' })
  label: string;
}

export class ProductsFilterOptionsResponseDto {
  @ApiProperty({ example: 'products' })
  dimension: string;

  @ApiProperty({ type: FilterOptionItemDto, isArray: true })
  items: FilterOptionItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
