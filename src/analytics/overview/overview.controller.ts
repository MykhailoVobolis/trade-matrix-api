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
import { FilterOptionsQueryDto } from './dto/filter-options-query.dto';
import { FilterOptionsResponseDto } from './dto/filter-options-response.dto';
import { OverviewExportQueryDto } from './dto/overview-export-query.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { OverviewRankingsQueryDto } from './dto/overview-rankings-query.dto';
import { OverviewRankingsResponseDto } from './dto/overview-rankings-response.dto';
import { OverviewResponseDto } from './dto/overview-response.dto';
import { OverviewTableQueryDto } from './dto/overview-table-query.dto';
import { OverviewTableResponseDto } from './dto/overview-table-response.dto';
import { OverviewService } from './overview.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overview dashboard analytics' })
  @ApiOkResponse({ type: OverviewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewQueryDto,
  ): Promise<OverviewResponseDto> {
    return this.overviewService.getOverview(user, query);
  }

  @Get('overview/table')
  @ApiOperation({ summary: 'Get paginated overview analytics table' })
  @ApiOkResponse({ type: OverviewTableResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getOverviewTable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewTableQueryDto,
  ): Promise<OverviewTableResponseDto> {
    return this.overviewService.getOverviewTable(user, query);
  }

  @Get('overview/rankings')
  @ApiOperation({
    summary: 'Get paginated overview rankings for the selected dimension',
  })
  @ApiOkResponse({ type: OverviewRankingsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getOverviewRankings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewRankingsQueryDto,
  ): Promise<OverviewRankingsResponseDto> {
    return this.overviewService.getOverviewRankings(user, query);
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Get paginated analytics filter options' })
  @ApiOkResponse({ type: FilterOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getFilterOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterOptionsQueryDto,
  ): Promise<FilterOptionsResponseDto> {
    return this.overviewService.getFilterOptions(user, query);
  }

  @Get('overview/export')
  @ApiOperation({ summary: 'Export overview analytics report' })
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
  async exportOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.overviewService.exportOverview(user, query);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return new StreamableFile(file.buffer);
  }
}
