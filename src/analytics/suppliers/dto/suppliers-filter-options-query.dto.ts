import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  SUPPLIERS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
} from '../constants/suppliers.constants';
import type { SuppliersAnalyticsFilterOptionDimension } from '../types/suppliers.types';
import { SuppliersBaseQueryDto } from './suppliers-base-query.dto';

export class SuppliersFilterOptionsQueryDto extends SuppliersBaseQueryDto {
  @ApiProperty({
    example: 'suppliers',
    enum: SUPPLIERS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
  })
  @IsIn(SUPPLIERS_ANALYTICS_FILTER_OPTION_DIMENSIONS)
  dimension: SuppliersAnalyticsFilterOptionDimension;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
    default: SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
    default: SUPPLIERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
