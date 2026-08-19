import { ApiProperty } from '@nestjs/swagger';

export class AuthSessionDto {
  @ApiProperty({ example: 'cmorabc123session' })
  id: string;

  @ApiProperty({ example: 'Desktop on macOS' })
  device: string;

  @ApiProperty({ example: 'Kyiv', nullable: true })
  location: string | null;

  @ApiProperty({ example: '2026-03-19T19:57:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-25T18:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: true })
  isCurrent: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;
}
