import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
  ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
  ANALYTICS_DEFAULT_TABLE_LIMIT,
  ANALYTICS_DEFAULT_TABLE_PAGE,
} from './constants/overview.constants';
import { FilterOptionsQueryDto } from './dto/filter-options-query.dto';
import { FilterOptionsResponseDto } from './dto/filter-options-response.dto';
import { OverviewExportQueryDto } from './dto/overview-export-query.dto';
import { OverviewExportResponseDto } from './dto/overview-export-response.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import {
  OverviewComparisonDto,
  OverviewMetricDto,
  OverviewPeriodDto,
  OverviewResponseDto,
} from './dto/overview-response.dto';
import { OverviewTableQueryDto } from './dto/overview-table-query.dto';
import { OverviewTableResponseDto } from './dto/overview-table-response.dto';
import { OverviewRepository } from './overview.repository';

@Injectable()
export class OverviewService {
  constructor(private readonly overviewRepository: OverviewRepository) {}

  getOverview(
    _user: AuthenticatedUser,
    query: OverviewQueryDto,
  ): OverviewResponseDto {
    return {
      period: this.toPeriod(query),
      comparison: this.toComparison(query),
      kpi: this.buildEmptyKpi(),
      trend: [],
      marketStructure: {},
      topBuyers: [],
      topSuppliers: [],
      topProducts: [],
      topRegions: [],
      insights: [],
    };
  }

  getOverviewTable(
    _user: AuthenticatedUser,
    query: OverviewTableQueryDto,
  ): OverviewTableResponseDto {
    void this.overviewRepository;

    return {
      items: [],
      total: 0,
      page: query.page ?? ANALYTICS_DEFAULT_TABLE_PAGE,
      limit: query.limit ?? ANALYTICS_DEFAULT_TABLE_LIMIT,
    };
  }

  getFilterOptions(
    _user: AuthenticatedUser,
    query: FilterOptionsQueryDto,
  ): FilterOptionsResponseDto {
    return {
      dimension: query.dimension,
      items: [],
      total: 0,
      page: query.page ?? ANALYTICS_DEFAULT_FILTER_OPTIONS_PAGE,
      limit: query.limit ?? ANALYTICS_DEFAULT_FILTER_OPTIONS_LIMIT,
    };
  }

  exportOverview(
    _user: AuthenticatedUser,
    query: OverviewExportQueryDto,
  ): OverviewExportResponseDto {
    return {
      format: query.format ?? 'csv',
      message: 'Overview export scaffold is ready.',
    };
  }

  private toPeriod(query: OverviewQueryDto): OverviewPeriodDto {
    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      timeGrain: query.timeGrain ?? null,
    };
  }

  private toComparison(query: OverviewQueryDto): OverviewComparisonDto {
    return {
      mode: query.comparisonMode ?? 'NONE',
      dateFrom: query.compareDateFrom ?? null,
      dateTo: query.compareDateTo ?? null,
    };
  }

  private buildEmptyKpi(): Record<string, OverviewMetricDto> {
    const emptyMetric: OverviewMetricDto = {
      current: 0,
      previous: null,
      deltaPercent: null,
      hasComparablePrevious: false,
    };

    return {
      salesWithVat: emptyMetric,
      purchasesWithVat: emptyMetric,
      balance: emptyMetric,
      activeBuyers: emptyMetric,
      activeSuppliers: emptyMetric,
      salesRegions: emptyMetric,
    };
  }
}
