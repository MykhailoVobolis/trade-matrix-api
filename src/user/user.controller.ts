import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AdminUserSummaryDto } from './dto/admin-user-summary.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { UploadedAvatarFile } from './types/uploaded-avatar-file.type';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin-managed users list' })
  @ApiOkResponse({ type: AdminUserSummaryDto, isArray: true })
  listAdminUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.listAdminUsers(user.userId);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'id', example: 'clx123example' })
  @ApiOkResponse({ type: AdminUserSummaryDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Cannot change your own role' })
  updateUserRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.userService.updateUserRole(user, id, dto);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'Mykhailo' },
        lastName: { type: 'string', example: 'Vobolis' },
        removeAvatar: { type: 'boolean', example: false },
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiOkResponse({ description: 'Profile updated' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() avatar?: UploadedAvatarFile,
  ) {
    return this.userService.updateProfile(user, dto, avatar);
  }

  @Delete('me/account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete the current user account' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async deleteCurrentAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.userService.deleteCurrentAccount(user);

    this.clearRefreshTokenCookie(res);

    return result;
  }

  private clearRefreshTokenCookie(res: Response): void {
    const cookieName =
      this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME') ??
      'refresh_token';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');

    res.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      domain: cookieDomain || undefined,
      path: '/api/auth',
    });
  }
}
