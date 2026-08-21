import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListRegistryImportsQueryDto {
  @ApiPropertyOptional({ example: 'buyers_registry_august.xlsx' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'completed',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  @IsOptional()
  @IsIn(['queued', 'processing', 'completed', 'failed'])
  status?: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;
}
