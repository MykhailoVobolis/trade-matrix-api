import { ApiProperty } from '@nestjs/swagger';

export class TotpSetupResponseDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP' })
  secret: string;

  @ApiProperty({
    example:
      'otpauth://totp/TradeMatrix:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=TradeMatrix&digits=6&period=30',
  })
  otpauthUrl: string;
}
