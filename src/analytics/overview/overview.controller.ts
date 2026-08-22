import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { FilterOptionsQueryDto } from './dto/filter-options-query.dto';
import { FilterOptionsResponseDto } from './dto/filter-options-response.dto';
import { OverviewExportQueryDto } from './dto/overview-export-query.dto';
import { OverviewExportResponseDto } from './dto/overview-export-response.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
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
  ): OverviewResponseDto {
    return this.overviewService.getOverview(user, query);
  }

  @Get('overview/table')
  @ApiOperation({ summary: 'Get paginated overview analytics table' })
  @ApiOkResponse({ type: OverviewTableResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getOverviewTable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewTableQueryDto,
  ): OverviewTableResponseDto {
    return this.overviewService.getOverviewTable(user, query);
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Get paginated analytics filter options' })
  @ApiOkResponse({ type: FilterOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getFilterOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterOptionsQueryDto,
  ): FilterOptionsResponseDto {
    return this.overviewService.getFilterOptions(user, query);
  }

  @Get('overview/export')
  @ApiOperation({ summary: 'Export overview analytics report' })
  @ApiOkResponse({ type: OverviewExportResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  exportOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OverviewExportQueryDto,
  ): OverviewExportResponseDto {
    return this.overviewService.exportOverview(user, query);
  }
}
