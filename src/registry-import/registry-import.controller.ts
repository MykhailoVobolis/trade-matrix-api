import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  REGISTRY_IMPORT_MAX_FILES,
  REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES,
} from './constants/registry-import.constants';
import { RegistryImportListResponseDto } from './dto/registry-import-list-response.dto';
import { RegistryImportStatsDto } from './dto/registry-import-stats.dto';
import { RegistryImportUploadResponseDto } from './dto/registry-import-upload-response.dto';
import { RegistryImportService } from './registry-import.service';
import { UploadedRegistryImportFile } from './types/registry-import-file.type';

@ApiTags('registry-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('registry-imports')
export class RegistryImportController {
  constructor(
    private readonly registryImportService: RegistryImportService,
  ) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', REGISTRY_IMPORT_MAX_FILES))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: REGISTRY_IMPORT_MAX_FILES,
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload up to 20 registry XLSX files for the current user',
  })
  @ApiOkResponse({ type: RegistryImportUploadResponseDto })
  @ApiBadRequestResponse({
    description: `Each file must be XLSX and must not exceed ${REGISTRY_IMPORT_MAX_FILE_SIZE_BYTES} bytes.`,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async uploadFiles(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: UploadedRegistryImportFile[],
  ): Promise<RegistryImportUploadResponseDto> {
    return {
      items: await this.registryImportService.uploadFiles(user, files),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List uploaded registry files for the current user' })
  @ApiOkResponse({ type: RegistryImportListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async listImports(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RegistryImportListResponseDto> {
    return {
      items: await this.registryImportService.listImports(user),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get registry import summary stats for the current user' })
  @ApiOkResponse({ type: RegistryImportStatsDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RegistryImportStatsDto> {
    return this.registryImportService.getStats(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a registry import and all of its rows' })
  @ApiParam({ name: 'id', example: 'cm0registryimport123' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async deleteImport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importId: string,
  ): Promise<MessageResponseDto> {
    return this.registryImportService.deleteImport(user, importId);
  }
}
