import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'Terms must be accepted' })
  terms: boolean;
}
