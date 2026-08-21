import { ApiProperty } from '@nestjs/swagger';
import { RegistryImportItemDto } from './registry-import-item.dto';

export class RegistryImportListResponseDto {
  @ApiProperty({ type: RegistryImportItemDto, isArray: true })
  items: RegistryImportItemDto[];

  @ApiProperty({ example: 8 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 5 })
  perPage: number;
}
