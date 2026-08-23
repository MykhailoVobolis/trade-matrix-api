import { ApiProperty } from '@nestjs/swagger';

export class OverviewExportResponseDto {
  @ApiProperty({ example: 'csv' })
  format: string;

  @ApiProperty({ example: 'Overview export scaffold is ready.' })
  message: string;
}
