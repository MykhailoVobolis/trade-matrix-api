import { Injectable, NotImplementedException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { RegistryImportItemDto } from './dto/registry-import-item.dto';
import { RegistryImportStatsDto } from './dto/registry-import-stats.dto';
import { UploadedRegistryImportFile } from './types/registry-import-file.type';
import { RegistryImportRepository } from './registry-import.repository';

@Injectable()
export class RegistryImportService {
  constructor(
    private readonly registryImportRepository: RegistryImportRepository,
  ) {}

  uploadFiles(
    _user: AuthenticatedUser,
    _files: UploadedRegistryImportFile[],
  ): Promise<RegistryImportItemDto[]> {
    void this.registryImportRepository;
    throw new NotImplementedException('Registry import upload is not implemented yet.');
  }

  listImports(_user: AuthenticatedUser): Promise<RegistryImportItemDto[]> {
    void this.registryImportRepository;
    throw new NotImplementedException('Registry import listing is not implemented yet.');
  }

  getStats(_user: AuthenticatedUser): Promise<RegistryImportStatsDto> {
    void this.registryImportRepository;
    throw new NotImplementedException('Registry import stats are not implemented yet.');
  }

  deleteImport(
    _user: AuthenticatedUser,
    _importId: string,
  ): Promise<MessageResponseDto> {
    void this.registryImportRepository;
    throw new NotImplementedException('Registry import deletion is not implemented yet.');
  }
}
