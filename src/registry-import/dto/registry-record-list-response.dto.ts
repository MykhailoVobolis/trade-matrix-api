import { ApiProperty } from '@nestjs/swagger';
import { RegistryRecordItemDto } from './registry-record-item.dto';

export class RegistryRecordListResponseDto {
  @ApiProperty({ type: RegistryRecordItemDto, isArray: true })
  items: RegistryRecordItemDto[];

  @ApiProperty({ example: 345 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  pageSize: number;
}
