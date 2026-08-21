import { Module } from '@nestjs/common';
import { RegistryImportController } from './registry-import.controller';
import { RegistryImportRepository } from './registry-import.repository';
import { RegistryImportService } from './registry-import.service';

@Module({
  controllers: [RegistryImportController],
  providers: [RegistryImportRepository, RegistryImportService],
})
export class RegistryImportModule {}
