import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorSettingsDto {
  @ApiProperty({ example: true })
  isTwoFactorEnabled: boolean;

  @ApiProperty({ example: 'email', enum: ['email', 'totp'] })
  method: 'email' | 'totp';

  @ApiProperty({ example: false })
  isTotpEnabled: boolean;
}
