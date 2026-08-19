import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'NewStrongPassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
