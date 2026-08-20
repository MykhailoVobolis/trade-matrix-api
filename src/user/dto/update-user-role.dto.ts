import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({ example: 'admin', enum: ['member', 'admin'] })
  @IsIn(['member', 'admin'])
  role: 'member' | 'admin';
}
