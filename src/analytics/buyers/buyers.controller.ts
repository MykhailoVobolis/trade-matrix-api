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
import { BuyersExportQueryDto } from './dto/buyers-export-query.dto';
import { BuyersFilterOptionsQueryDto } from './dto/buyers-filter-options-query.dto';
import { BuyersFilterOptionsResponseDto } from './dto/buyers-filter-options-response.dto';
import { BuyersQueryDto } from './dto/buyers-query.dto';
import { BuyersRankingsQueryDto } from './dto/buyers-rankings-query.dto';
import { BuyersRankingsResponseDto } from './dto/buyers-rankings-response.dto';
import { BuyersResponseDto } from './dto/buyers-response.dto';
import { BuyersTableQueryDto } from './dto/buyers-table-query.dto';
import { BuyersTableResponseDto } from './dto/buyers-table-response.dto';
import { BuyersService } from './buyers.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get('buyers')
  @ApiOperation({
    summary: 'Get buyer-scoped analytics dashboard for the current tenant',
    description:
      'Returns buyer analytics only in the scope of the authenticated user. userId is never accepted from query params.',
  })
  @ApiOkResponse({ type: BuyersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getBuyers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BuyersQueryDto,
  ): Promise<BuyersResponseDto> {
    return this.buyersService.getBuyers(user, query);
  }

  @Get('buyers/table')
  @ApiOperation({
    summary: 'Get paginated buyer operations table for the current tenant',
    description:
      'Returns an aggregated buyer-scoped table only for the authenticated user tenant. Pagination and sorting are fully server-side.',
  })
  @ApiOkResponse({ type: BuyersTableResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getBuyersTable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BuyersTableQueryDto,
  ): Promise<BuyersTableResponseDto> {
    return this.buyersService.getBuyersTable(user, query);
  }

  @Get('buyers/rankings')
  @ApiOperation({
    summary: 'Get paginated buyer page rankings for the selected dimension',
  })
  @ApiOkResponse({ type: BuyersRankingsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getBuyersRankings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BuyersRankingsQueryDto,
  ): Promise<BuyersRankingsResponseDto> {
    return this.buyersService.getBuyersRankings(user, query);
  }

  @Get('buyers/filter-options')
  @ApiOperation({
    summary: 'Get buyer analytics filter options for the current tenant',
    description:
      'Returns paginated filter options in the scope of the authenticated user. Non-buyer dimensions cascade from selected buyers.',
  })
  @ApiOkResponse({ type: BuyersFilterOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getFilterOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BuyersFilterOptionsQueryDto,
  ): Promise<BuyersFilterOptionsResponseDto> {
    return this.buyersService.getFilterOptions(user, query);
  }

  @Get('buyers/export')
  @ApiOperation({
    summary: 'Export buyer analytics report for the current tenant',
    description:
      'Exports aggregated buyer analytics rows only for the authenticated user tenant using the same filter contract as the UI.',
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
  async exportBuyers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BuyersExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.buyersService.exportBuyers(user, query);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return new StreamableFile(file.buffer);
  }
}
