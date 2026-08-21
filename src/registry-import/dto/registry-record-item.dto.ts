import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistryRecordItemDto {
  @ApiProperty({ example: 'cm0registryrecord123' })
  id: string;

  @ApiProperty({ example: 'cm0registryimport123' })
  importId: string;

  @ApiProperty({ example: 2 })
  rowNumber: number;

  @ApiPropertyOptional({ example: '80' })
  sellerRegionCode?: string | null;

  @ApiPropertyOptional({ example: '8001' })
  sellerDistrictCode?: string | null;

  @ApiPropertyOptional({ example: '1234567890' })
  sellerIpn?: string | null;

  @ApiPropertyOptional({ example: 'ТОВ Приклад' })
  sellerName?: string | null;

  @ApiPropertyOptional({ example: '32' })
  buyerRegionCode?: string | null;

  @ApiPropertyOptional({ example: '3201' })
  buyerDistrictCode?: string | null;

  @ApiPropertyOptional({ example: '0987654321' })
  buyerIpn?: string | null;

  @ApiPropertyOptional({ example: 'ФОП Іваненко' })
  buyerName?: string | null;

  @ApiPropertyOptional({ example: '2026-08-12T00:00:00.000Z' })
  invoiceDate?: Date | null;

  @ApiPropertyOptional({ example: 'пшениця' })
  itemDescription?: string | null;

  @ApiPropertyOptional({ example: '1001990000' })
  uktzedCode?: string | null;

  @ApiPropertyOptional({ example: 'кг' })
  unitName?: string | null;

  @ApiPropertyOptional({ example: '1250.50' })
  unitPriceActual?: string | null;

  @ApiPropertyOptional({ example: '2026-08-21T10:00:00.000Z' })
  createdAt?: Date;
}
