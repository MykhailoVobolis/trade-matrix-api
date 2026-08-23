import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  ANALYTICS_FILTER_OPTION_DIMENSIONS,
} from '../constants/overview.constants';
import type { AnalyticsFilterOptionDimension } from '../types/overview.types';
import { OverviewBaseQueryDto } from './overview-base-query.dto';

export class FilterOptionsQueryDto extends OverviewBaseQueryDto {
  @ApiProperty({
    example: 'buyers',
    enum: ANALYTICS_FILTER_OPTION_DIMENSIONS,
  })
  @IsIn(ANALYTICS_FILTER_OPTION_DIMENSIONS)
  dimension: AnalyticsFilterOptionDimension;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
    default: ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
    default: ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
