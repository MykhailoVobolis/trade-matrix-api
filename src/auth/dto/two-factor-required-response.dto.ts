import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorRequiredResponseDto {
  @ApiProperty({ example: true })
  requiresTwoFactor: true;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.two-factor-token.signature',
  })
  twoFactorToken: string;

  @ApiProperty({ example: 'email', enum: ['email', 'totp'] })
  method: 'email' | 'totp';

  @ApiProperty({
    example: 'Two-factor authentication code sent successfully.',
  })
  message: string;
}
