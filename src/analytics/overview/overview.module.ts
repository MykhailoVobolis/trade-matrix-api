import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewRepository } from './overview.repository';
import { OverviewService } from './overview.service';

@Module({
  controllers: [OverviewController],
  providers: [OverviewRepository, OverviewService],
})
export class OverviewModule {}
