import { ApiProperty } from '@nestjs/swagger';

export class BuyersFilterOptionItemDto {
  @ApiProperty({ example: '42794130' })
  value: string;

  @ApiProperty({ example: 'БЕСТ ТЕРРА ОЙЛ' })
  label: string;
}

export class BuyersFilterOptionsResponseDto {
  @ApiProperty({ example: 'buyers' })
  dimension: string;

  @ApiProperty({ type: BuyersFilterOptionItemDto, isArray: true })
  items: BuyersFilterOptionItemDto[];

  @ApiProperty({ example: 0 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
