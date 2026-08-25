import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BUYERS_ANALYTICS_EXPORT_FORMATS } from '../constants/buyers.constants';
import type { BuyersAnalyticsExportFormat } from '../types/buyers.types';
import { BuyersBaseQueryDto } from './buyers-base-query.dto';

export class BuyersExportQueryDto extends BuyersBaseQueryDto {
  @ApiPropertyOptional({
    example: 'csv',
    enum: BUYERS_ANALYTICS_EXPORT_FORMATS,
  })
  @IsOptional()
  @IsIn(BUYERS_ANALYTICS_EXPORT_FORMATS)
  format?: BuyersAnalyticsExportFormat;
}
