import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PRODUCTS_ANALYTICS_EXPORT_FORMATS } from '../constants/products.constants';
import type { ProductsAnalyticsExportFormat } from '../types/products.types';
import { ProductsBaseQueryDto } from './products-base-query.dto';

export class ProductsExportQueryDto extends ProductsBaseQueryDto {
  @ApiPropertyOptional({
    example: 'csv',
    enum: PRODUCTS_ANALYTICS_EXPORT_FORMATS,
  })
  @IsOptional()
  @IsIn(PRODUCTS_ANALYTICS_EXPORT_FORMATS)
  format?: ProductsAnalyticsExportFormat;
}
