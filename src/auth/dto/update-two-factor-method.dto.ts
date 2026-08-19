import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateTwoFactorMethodDto {
  @ApiProperty({ example: 'totp', enum: ['email', 'totp'] })
  @IsIn(['email', 'totp'])
  method: 'email' | 'totp';
}
