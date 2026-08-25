import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  PRODUCTS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
} from '../constants/products.constants';
import type { ProductsAnalyticsFilterOptionDimension } from '../types/products.types';
import { ProductsBaseQueryDto } from './products-base-query.dto';

export class ProductsFilterOptionsQueryDto extends ProductsBaseQueryDto {
  @ApiProperty({
    example: 'products',
    enum: PRODUCTS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
  })
  @IsIn(PRODUCTS_ANALYTICS_FILTER_OPTION_DIMENSIONS)
  dimension: ProductsAnalyticsFilterOptionDimension;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
    default: PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
    default: PRODUCTS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
