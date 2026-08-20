import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListRegistryRecordsQueryDto {
  @ApiPropertyOptional({ example: '80' })
  @IsOptional()
  @IsString()
  sellerRegionCode?: string;

  @ApiPropertyOptional({ example: '8001' })
  @IsOptional()
  @IsString()
  sellerDistrictCode?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  sellerIpn?: string;

  @ApiPropertyOptional({ example: 'ТОВ Приклад' })
  @IsOptional()
  @IsString()
  sellerName?: string;

  @ApiPropertyOptional({ example: '32' })
  @IsOptional()
  @IsString()
  buyerRegionCode?: string;

  @ApiPropertyOptional({ example: '3201' })
  @IsOptional()
  @IsString()
  buyerDistrictCode?: string;

  @ApiPropertyOptional({ example: '0987654321' })
  @IsOptional()
  @IsString()
  buyerIpn?: string;

  @ApiPropertyOptional({ example: 'ФОП Іваненко' })
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsString()
  invoiceDateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsString()
  invoiceDateTo?: string;

  @ApiPropertyOptional({ example: 'пшениця' })
  @IsOptional()
  @IsString()
  itemDescription?: string;

  @ApiPropertyOptional({ example: '1001990000' })
  @IsOptional()
  @IsString()
  uktzedCode?: string;

  @ApiPropertyOptional({ example: 'кг' })
  @IsOptional()
  @IsString()
  unitName?: string;

  @ApiPropertyOptional({
    example: 1,
    description: '1-based page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Items per page',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({
    example: 'invoiceDate',
    enum: ['invoiceDate', 'sellerName', 'buyerName', 'createdAt'],
    default: 'invoiceDate',
  })
  @IsOptional()
  @IsIn(['invoiceDate', 'sellerName', 'buyerName', 'createdAt'])
  sortBy?: 'invoiceDate' | 'sellerName' | 'buyerName' | 'createdAt';

  @ApiPropertyOptional({
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
