import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE,
  SUPPLIERS_ANALYTICS_TABLE_SORT_FIELDS,
} from '../constants/suppliers.constants';
import type { SuppliersAnalyticsTableSortField } from '../types/suppliers.types';
import { SuppliersBaseQueryDto } from './suppliers-base-query.dto';

export class SuppliersTableQueryDto extends SuppliersBaseQueryDto {
  @ApiPropertyOptional({
    example: SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE,
    default: SUPPLIERS_ANALYTICS_DEFAULT_TABLE_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
    default: SUPPLIERS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: 'salesWithVat',
    enum: SUPPLIERS_ANALYTICS_TABLE_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(SUPPLIERS_ANALYTICS_TABLE_SORT_FIELDS)
  sortBy?: SuppliersAnalyticsTableSortField;
}
