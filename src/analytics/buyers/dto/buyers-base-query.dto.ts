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
  BUYERS_ANALYTICS_COMPARISON_MODES,
  BUYERS_ANALYTICS_TIME_GRAINS,
} from '../constants/buyers.constants';
import type {
  BuyersAnalyticsComparisonMode,
  BuyersAnalyticsTimeGrain,
} from '../types/buyers.types';
import { transformStringArray } from '../../overview/dto/transform-string-array.util';

export class BuyersBaseQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  dateFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    example: 'PREVIOUS_PERIOD',
    enum: BUYERS_ANALYTICS_COMPARISON_MODES,
  })
  @IsOptional()
  @IsIn(BUYERS_ANALYTICS_COMPARISON_MODES)
  comparisonMode?: BuyersAnalyticsComparisonMode;

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
    enum: BUYERS_ANALYTICS_TIME_GRAINS,
  })
  @IsOptional()
  @IsIn(BUYERS_ANALYTICS_TIME_GRAINS)
  timeGrain?: BuyersAnalyticsTimeGrain;
}
