import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistryImportStatus } from './registry-import-status.dto';

export class RegistryImportItemDto {
  @ApiProperty({ example: 'cm0registryimport123' })
  id: string;

  @ApiProperty({ example: '42794130-ПЗ.xlsx' })
  fileName: string;

  @ApiProperty({
    example: 'completed',
    enum: RegistryImportStatus,
  })
  status: RegistryImportStatus;

  @ApiProperty({ example: 3145728 })
  sizeBytes: number;

  @ApiProperty({ example: 3.0 })
  sizeMb: number;

  @ApiProperty({ example: 15432 })
  rowCount: number;

  @ApiPropertyOptional({ example: 'This file has already been uploaded.' })
  errorMessage?: string | null;

  @ApiProperty({ example: '2026-08-20T14:10:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2026-08-20T14:10:01.000Z' })
  startedAt?: Date | null;

  @ApiPropertyOptional({ example: '2026-08-20T14:10:15.000Z' })
  finishedAt?: Date | null;
}
