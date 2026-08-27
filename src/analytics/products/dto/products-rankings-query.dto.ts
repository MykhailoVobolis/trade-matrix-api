import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  PRODUCTS_ANALYTICS_RANKING_DIMENSIONS,
} from '../constants/products.constants';
import type { ProductsAnalyticsRankingDimension } from '../types/products.types';
import { ProductsBaseQueryDto } from './products-base-query.dto';

export class ProductsRankingsQueryDto extends ProductsBaseQueryDto {
  @ApiProperty({
    example: 'buyers',
    enum: PRODUCTS_ANALYTICS_RANKING_DIMENSIONS,
  })
  @IsIn(PRODUCTS_ANALYTICS_RANKING_DIMENSIONS)
  dimension: ProductsAnalyticsRankingDimension;

  @ApiPropertyOptional({
    example: PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
    default: PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
    default: PRODUCTS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
