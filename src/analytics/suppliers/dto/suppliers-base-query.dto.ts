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
  SUPPLIERS_ANALYTICS_COMPARISON_MODES,
  SUPPLIERS_ANALYTICS_SORT_DIRECTIONS,
  SUPPLIERS_ANALYTICS_TIME_GRAINS,
} from '../constants/suppliers.constants';
import type {
  SuppliersAnalyticsComparisonMode,
  SuppliersAnalyticsSortDirection,
  SuppliersAnalyticsTimeGrain,
} from '../types/suppliers.types';
import { transformStringArray } from '../../overview/dto/transform-string-array.util';

export class SuppliersBaseQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  dateFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    example: 'PREVIOUS_PERIOD',
    enum: SUPPLIERS_ANALYTICS_COMPARISON_MODES,
  })
  @IsOptional()
  @IsIn(SUPPLIERS_ANALYTICS_COMPARISON_MODES)
  comparisonMode?: SuppliersAnalyticsComparisonMode;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  compareDateFrom?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  compareDateTo?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['42794130'],
    description: 'Supplier identity filter by tax number.',
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  supplierTaxNumbers?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['40075815'],
    description: 'Buyer identity filter by tax number.',
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  buyerTaxNumbers?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['15'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  buyerRegionCodes?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['2710'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d+$/u, { each: true })
  uktzed?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Літол-24'],
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @ApiPropertyOptional({
    example: 'MONTH',
    enum: SUPPLIERS_ANALYTICS_TIME_GRAINS,
  })
  @IsOptional()
  @IsIn(SUPPLIERS_ANALYTICS_TIME_GRAINS)
  timeGrain?: SuppliersAnalyticsTimeGrain;

  @ApiPropertyOptional({
    example: 'desc',
    enum: SUPPLIERS_ANALYTICS_SORT_DIRECTIONS,
  })
  @IsOptional()
  @IsIn(SUPPLIERS_ANALYTICS_SORT_DIRECTIONS)
  sortDirection?: SuppliersAnalyticsSortDirection;
}
