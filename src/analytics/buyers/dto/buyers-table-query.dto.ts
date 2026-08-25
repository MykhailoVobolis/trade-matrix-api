import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BUYERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  BUYERS_ANALYTICS_DEFAULT_TABLE_PAGE,
  BUYERS_ANALYTICS_SORT_DIRECTIONS,
  BUYERS_ANALYTICS_TABLE_SORT_FIELDS,
} from '../constants/buyers.constants';
import type {
  BuyersAnalyticsSortDirection,
  BuyersAnalyticsTableSortField,
} from '../types/buyers.types';
import { BuyersBaseQueryDto } from './buyers-base-query.dto';

export class BuyersTableQueryDto extends BuyersBaseQueryDto {
  @ApiPropertyOptional({
    example: BUYERS_ANALYTICS_DEFAULT_TABLE_PAGE,
    default: BUYERS_ANALYTICS_DEFAULT_TABLE_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: BUYERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
    default: BUYERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: 'purchasesWithVat',
    enum: BUYERS_ANALYTICS_TABLE_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(BUYERS_ANALYTICS_TABLE_SORT_FIELDS)
  sortBy?: BuyersAnalyticsTableSortField;

  @ApiPropertyOptional({
    example: 'desc',
    enum: BUYERS_ANALYTICS_SORT_DIRECTIONS,
  })
  @IsOptional()
  @IsIn(BUYERS_ANALYTICS_SORT_DIRECTIONS)
  sortDirection?: BuyersAnalyticsSortDirection;
}
