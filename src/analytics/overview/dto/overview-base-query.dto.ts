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
  ANALYTICS_COMPARISON_MODES,
  ANALYTICS_SORT_DIRECTIONS,
  ANALYTICS_TIME_GRAINS,
} from '../constants/overview.constants';
import type {
  AnalyticsComparisonMode,
  AnalyticsSortDirection,
  AnalyticsTimeGrain,
} from '../types/overview.types';
import { transformStringArray } from './transform-string-array.util';

export class OverviewBaseQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  dateFrom: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    example: 'PREVIOUS_PERIOD',
    enum: ANALYTICS_COMPARISON_MODES,
  })
  @IsOptional()
  @IsIn(ANALYTICS_COMPARISON_MODES)
  comparisonMode?: AnalyticsComparisonMode;

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
    enum: ANALYTICS_TIME_GRAINS,
  })
  @IsOptional()
  @IsIn(ANALYTICS_TIME_GRAINS)
  timeGrain?: AnalyticsTimeGrain;

  @ApiPropertyOptional({
    example: 'desc',
    enum: ANALYTICS_SORT_DIRECTIONS,
  })
  @IsOptional()
  @IsIn(ANALYTICS_SORT_DIRECTIONS)
  sortDirection?: AnalyticsSortDirection;
}
