import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResendTwoFactorDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.two-factor-token.signature',
  })
  @IsOptional()
  @IsString()
  twoFactorToken?: string;
}
