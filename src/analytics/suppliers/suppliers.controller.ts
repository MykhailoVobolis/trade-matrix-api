import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { SuppliersExportQueryDto } from './dto/suppliers-export-query.dto';
import { SuppliersFilterOptionsQueryDto } from './dto/suppliers-filter-options-query.dto';
import { SuppliersFilterOptionsResponseDto } from './dto/suppliers-filter-options-response.dto';
import { SuppliersQueryDto } from './dto/suppliers-query.dto';
import { SuppliersResponseDto } from './dto/suppliers-response.dto';
import { SuppliersTableQueryDto } from './dto/suppliers-table-query.dto';
import { SuppliersTableResponseDto } from './dto/suppliers-table-response.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get('suppliers')
  @ApiOperation({
    summary: 'Get supplier-scoped analytics dashboard for the current tenant',
    description:
      'Returns supplier analytics only in the scope of the authenticated user. userId is never accepted from query params.',
  })
  @ApiOkResponse({ type: SuppliersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getSuppliers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuppliersQueryDto,
  ): Promise<SuppliersResponseDto> {
    return this.suppliersService.getSuppliers(user, query);
  }

  @Get('suppliers/table')
  @ApiOperation({
    summary: 'Get paginated supplier operations table for the current tenant',
    description:
      'Returns an aggregated supplier-scoped table only for the authenticated user tenant. Pagination and sorting are fully server-side.',
  })
  @ApiOkResponse({ type: SuppliersTableResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getSuppliersTable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuppliersTableQueryDto,
  ): Promise<SuppliersTableResponseDto> {
    return this.suppliersService.getSuppliersTable(user, query);
  }

  @Get('suppliers/filter-options')
  @ApiOperation({
    summary: 'Get supplier analytics filter options for the current tenant',
    description:
      'Returns paginated filter options in the scope of the authenticated user. Non-supplier dimensions are intended to cascade from selected suppliers.',
  })
  @ApiOkResponse({ type: SuppliersFilterOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getFilterOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuppliersFilterOptionsQueryDto,
  ): Promise<SuppliersFilterOptionsResponseDto> {
    return this.suppliersService.getFilterOptions(user, query);
  }

  @Get('suppliers/export')
  @ApiOperation({
    summary: 'Export supplier analytics report for the current tenant',
    description:
      'Exports aggregated supplier analytics rows only for the authenticated user tenant using the same filter contract as the UI.',
  })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async exportSuppliers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuppliersExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.suppliersService.exportSuppliers(user, query);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return new StreamableFile(file.buffer);
  }
}
