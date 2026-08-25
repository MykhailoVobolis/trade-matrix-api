import { ApiProperty } from '@nestjs/swagger';

export class ProductsExportResponseDto {
  @ApiProperty({ example: 'csv' })
  format: string;

  @ApiProperty({ example: 'Products export scaffold is ready.' })
  message: string;
}
