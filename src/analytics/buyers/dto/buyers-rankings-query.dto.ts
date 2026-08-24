import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BUYERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  BUYERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  BUYERS_ANALYTICS_RANKING_DIMENSIONS,
} from '../constants/buyers.constants';
import type { BuyersAnalyticsRankingDimension } from '../types/buyers.types';
import { BuyersBaseQueryDto } from './buyers-base-query.dto';

export class BuyersRankingsQueryDto extends BuyersBaseQueryDto {
  @ApiProperty({
    example: 'suppliers',
    enum: BUYERS_ANALYTICS_RANKING_DIMENSIONS,
  })
  @IsIn(BUYERS_ANALYTICS_RANKING_DIMENSIONS)
  dimension: BuyersAnalyticsRankingDimension;

  @ApiPropertyOptional({
    example: BUYERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
    default: BUYERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: BUYERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
    default: BUYERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
