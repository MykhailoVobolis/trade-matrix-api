import { ApiProperty } from '@nestjs/swagger';

export class RegistryImportStatsDto {
  @ApiProperty({ example: 2 })
  completedCount: number;

  @ApiProperty({ example: 1 })
  processingCount: number;

  @ApiProperty({ example: 4 })
  queuedCount: number;

  @ApiProperty({ example: 1 })
  failedCount: number;

  @ApiProperty({ example: 8 })
  totalFiles: number;

  @ApiProperty({ example: 27682406 })
  totalSizeBytes: number;

  @ApiProperty({ example: 26.4 })
  totalSizeMb: number;
}
