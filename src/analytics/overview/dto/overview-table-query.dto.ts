import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ANALYTICS_DEFAULT_TABLE_LIMIT,
  ANALYTICS_DEFAULT_TABLE_PAGE,
  ANALYTICS_TABLE_SORT_FIELDS,
} from '../constants/overview.constants';
import type { AnalyticsTableSortField } from '../types/overview.types';
import { OverviewBaseQueryDto } from './overview-base-query.dto';

export class OverviewTableQueryDto extends OverviewBaseQueryDto {
  @ApiPropertyOptional({
    example: ANALYTICS_DEFAULT_TABLE_PAGE,
    default: ANALYTICS_DEFAULT_TABLE_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: ANALYTICS_DEFAULT_TABLE_LIMIT,
    default: ANALYTICS_DEFAULT_TABLE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: 'salesWithVat',
    enum: ANALYTICS_TABLE_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(ANALYTICS_TABLE_SORT_FIELDS)
  sortBy?: AnalyticsTableSortField;
}
