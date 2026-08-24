import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  ANALYTICS_DEFAULT_RANKINGS_PAGE,
  ANALYTICS_RANKING_DIMENSIONS,
} from '../constants/overview.constants';
import type { AnalyticsRankingDimension } from '../types/overview.types';
import { OverviewBaseQueryDto } from './overview-base-query.dto';

export class OverviewRankingsQueryDto extends OverviewBaseQueryDto {
  @ApiProperty({
    example: 'buyers',
    enum: ANALYTICS_RANKING_DIMENSIONS,
  })
  @IsIn(ANALYTICS_RANKING_DIMENSIONS)
  dimension: AnalyticsRankingDimension;

  @ApiPropertyOptional({
    example: ANALYTICS_DEFAULT_RANKINGS_PAGE,
    default: ANALYTICS_DEFAULT_RANKINGS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: ANALYTICS_DEFAULT_RANKINGS_LIMIT,
    default: ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
