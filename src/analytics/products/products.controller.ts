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
import { ProductsFilterOptionsQueryDto } from './dto/products-filter-options-query.dto';
import { ProductsFilterOptionsResponseDto } from './dto/products-filter-options-response.dto';
import { ProductsExportQueryDto } from './dto/products-export-query.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { ProductsRankingsQueryDto } from './dto/products-rankings-query.dto';
import { ProductsRankingsResponseDto } from './dto/products-rankings-response.dto';
import { ProductsResponseDto } from './dto/products-response.dto';
import { ProductsTableQueryDto } from './dto/products-table-query.dto';
import { ProductsTableResponseDto } from './dto/products-table-response.dto';
import { ProductsService } from './products.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Get product-scoped analytics dashboard for the current tenant',
    description:
      'Returns product analytics only in the scope of the authenticated user. userId is never accepted from query params.',
  })
  @ApiOkResponse({ type: ProductsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProductsQueryDto,
  ): Promise<ProductsResponseDto> {
    return this.productsService.getProducts(user, query);
  }

  @Get('products/table')
  @ApiOperation({
    summary: 'Get paginated product analytics table for the current tenant',
    description:
      'Returns an aggregated product-scoped table only for the authenticated user tenant. Pagination and sorting are fully server-side.',
  })
  @ApiOkResponse({ type: ProductsTableResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProductsTable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProductsTableQueryDto,
  ): Promise<ProductsTableResponseDto> {
    return this.productsService.getProductsTable(user, query);
  }

  @Get('products/rankings')
  @ApiOperation({
    summary: 'Get paginated product page rankings for the selected dimension',
  })
  @ApiOkResponse({ type: ProductsRankingsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProductsRankings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProductsRankingsQueryDto,
  ): Promise<ProductsRankingsResponseDto> {
    return this.productsService.getProductsRankings(user, query);
  }

  @Get('products/filter-options')
  @ApiOperation({
    summary: 'Get product analytics filter options for the current tenant',
    description:
      'Returns paginated filter options in the scope of the authenticated user. Secondary dimensions cascade from selected products and/or UKTZED.',
  })
  @ApiOkResponse({ type: ProductsFilterOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getFilterOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProductsFilterOptionsQueryDto,
  ): Promise<ProductsFilterOptionsResponseDto> {
    return this.productsService.getFilterOptions(user, query);
  }

  @Get('products/export')
  @ApiOperation({
    summary: 'Export product analytics report for the current tenant',
    description:
      'Exports aggregated product analytics rows only for the authenticated user tenant using the same filter contract as the UI.',
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
  async exportProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProductsExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.productsService.exportProducts(user, query);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return new StreamableFile(file.buffer);
  }
}
