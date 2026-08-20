import { ApiProperty } from '@nestjs/swagger';

export class AdminUserSummaryDto {
  @ApiProperty({ example: 'clx123abc0000xyz987' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'member', enum: ['member', 'admin'] })
  role: 'member' | 'admin';
}
