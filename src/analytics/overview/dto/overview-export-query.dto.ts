import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ANALYTICS_EXPORT_FORMATS } from '../constants/overview.constants';
import type { AnalyticsExportFormat } from '../types/overview.types';
import { OverviewBaseQueryDto } from './overview-base-query.dto';

export class OverviewExportQueryDto extends OverviewBaseQueryDto {
  @ApiPropertyOptional({
    example: 'csv',
    enum: ANALYTICS_EXPORT_FORMATS,
  })
  @IsOptional()
  @IsIn(ANALYTICS_EXPORT_FORMATS)
  format?: AnalyticsExportFormat;
}
