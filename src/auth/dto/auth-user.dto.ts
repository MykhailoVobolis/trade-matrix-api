import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 'clx123abc0000xyz987' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'member', enum: ['member', 'admin'] })
  role: 'member' | 'admin';

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/avatar.jpg',
    nullable: true,
  })
  avatarUrl: string | null;
}
