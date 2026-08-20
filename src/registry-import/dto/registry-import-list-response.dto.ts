import { ApiProperty } from '@nestjs/swagger';
import { RegistryImportItemDto } from './registry-import-item.dto';

export class RegistryImportListResponseDto {
  @ApiProperty({ type: RegistryImportItemDto, isArray: true })
  items: RegistryImportItemDto[];
}
