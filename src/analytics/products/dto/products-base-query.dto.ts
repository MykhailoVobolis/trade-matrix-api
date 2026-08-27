import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRODUCTS_ANALYTICS_COMPARISON_MODES,
  PRODUCTS_ANALYTICS_SORT_DIRECTIONS,
  PRODUCTS_ANALYTICS_TIME_GRAINS,
} from '../constants/products.constants';
import type {
  ProductsAnalyticsComparisonMode,
  ProductsAnalyticsSortDirection,
  ProductsAnalyticsTimeGrain,
} from '../types/products.types';
import { transformStringArray } from './transform-string-array.util';

export class ProductsBaseQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  dateFrom: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    example: 'PREVIOUS_PERIOD',
    enum: PRODUCTS_ANALYTICS_COMPARISON_MODES,
  })
  @IsOptional()
  @IsIn(PRODUCTS_ANALYTICS_COMPARISON_MODES)
  comparisonMode?: ProductsAnalyticsComparisonMode;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  compareDateFrom?: string;

  @ApiPropertyOptional({ example: '2025-05-31' })
  @IsOptional()
  @IsDateString()
  compareDateTo?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['2710', '3403'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d+$/u, { each: true })
  uktzed?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Літол-24', 'Aramco Prima 230'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['10', '26'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  buyerRegionCodes?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['40075815'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  buyerTaxNumbers?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['42794130'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  supplierTaxNumbers?: string[];

  @ApiPropertyOptional({
    example: 'MONTH',
    enum: PRODUCTS_ANALYTICS_TIME_GRAINS,
  })
  @IsOptional()
  @IsIn(PRODUCTS_ANALYTICS_TIME_GRAINS)
  timeGrain?: ProductsAnalyticsTimeGrain;

  @ApiPropertyOptional({
    example: 'desc',
    enum: PRODUCTS_ANALYTICS_SORT_DIRECTIONS,
  })
  @IsOptional()
  @IsIn(PRODUCTS_ANALYTICS_SORT_DIRECTIONS)
  sortDirection?: ProductsAnalyticsSortDirection;
}
