import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetTokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.recovery-token.signature',
  })
  recoveryToken: string;

  @ApiProperty({ example: 'Password reset code verified successfully.' })
  message: string;
}
