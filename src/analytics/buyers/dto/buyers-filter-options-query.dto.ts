import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  BUYERS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
} from '../constants/buyers.constants';
import type { BuyersAnalyticsFilterOptionDimension } from '../types/buyers.types';
import { BuyersBaseQueryDto } from './buyers-base-query.dto';

export class BuyersFilterOptionsQueryDto extends BuyersBaseQueryDto {
  @ApiProperty({
    example: 'buyers',
    enum: BUYERS_ANALYTICS_FILTER_OPTION_DIMENSIONS,
  })
  @IsIn(BUYERS_ANALYTICS_FILTER_OPTION_DIMENSIONS)
  dimension: BuyersAnalyticsFilterOptionDimension;

  @ApiPropertyOptional({ example: 'МЕГАРОСТ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
    default: BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
    default: BUYERS_ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
