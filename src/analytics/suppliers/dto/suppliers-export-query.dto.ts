import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPLIERS_ANALYTICS_EXPORT_FORMATS } from '../constants/suppliers.constants';
import type { SuppliersAnalyticsExportFormat } from '../types/suppliers.types';
import { SuppliersBaseQueryDto } from './suppliers-base-query.dto';

export class SuppliersExportQueryDto extends SuppliersBaseQueryDto {
  @ApiPropertyOptional({
    example: 'csv',
    enum: SUPPLIERS_ANALYTICS_EXPORT_FORMATS,
  })
  @IsOptional()
  @IsIn(SUPPLIERS_ANALYTICS_EXPORT_FORMATS)
  format?: SuppliersAnalyticsExportFormat;
}
