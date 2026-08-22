import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterOptionItemDto {
  @ApiProperty({ example: '42794130' })
  value: string;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ', nullable: true })
  label: string | null;
}

export class FilterOptionsResponseDto {
  @ApiProperty({ example: 'buyers' })
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
