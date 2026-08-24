import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUPPLIERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  SUPPLIERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  SUPPLIERS_ANALYTICS_RANKING_DIMENSIONS,
} from '../constants/suppliers.constants';
import type { SuppliersAnalyticsRankingDimension } from '../types/suppliers.types';
import { SuppliersBaseQueryDto } from './suppliers-base-query.dto';

export class SuppliersRankingsQueryDto extends SuppliersBaseQueryDto {
  @ApiProperty({
    example: 'buyers',
    enum: SUPPLIERS_ANALYTICS_RANKING_DIMENSIONS,
  })
  @IsIn(SUPPLIERS_ANALYTICS_RANKING_DIMENSIONS)
  dimension: SuppliersAnalyticsRankingDimension;

  @ApiPropertyOptional({
    example: SUPPLIERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
    default: SUPPLIERS_ANALYTICS_DEFAULT_RANKINGS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: SUPPLIERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
    default: SUPPLIERS_ANALYTICS_DEFAULT_RANKINGS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
