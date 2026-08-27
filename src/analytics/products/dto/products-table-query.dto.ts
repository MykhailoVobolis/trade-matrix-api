import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRODUCTS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  PRODUCTS_ANALYTICS_DEFAULT_TABLE_PAGE,
  PRODUCTS_ANALYTICS_TABLE_SORT_FIELDS,
} from '../constants/products.constants';
import type { ProductsAnalyticsTableSortField } from '../types/products.types';
import { ProductsBaseQueryDto } from './products-base-query.dto';

export class ProductsTableQueryDto extends ProductsBaseQueryDto {
  @ApiPropertyOptional({
    example: PRODUCTS_ANALYTICS_DEFAULT_TABLE_PAGE,
    default: PRODUCTS_ANALYTICS_DEFAULT_TABLE_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: PRODUCTS_ANALYTICS_DEFAULT_TABLE_LIMIT,
    default: PRODUCTS_ANALYTICS_DEFAULT_TABLE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: 'salesWithVat',
    enum: PRODUCTS_ANALYTICS_TABLE_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(PRODUCTS_ANALYTICS_TABLE_SORT_FIELDS)
  sortBy?: ProductsAnalyticsTableSortField;
}
