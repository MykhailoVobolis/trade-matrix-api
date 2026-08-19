import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageResponseDto } from '../auth/dto/message-response.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UploadedAvatarFile } from './types/uploaded-avatar-file.type';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  listAdminUsers(currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return user;
  }

  async updateUserRole(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateUserRoleDto,
  ) {
    if (currentUser.userId === id) {
      throw new ConflictException('You cannot change your own role');
    }

    const targetUser = await this.findUserById(id);

    if (targetUser.role === dto.role) {
      return {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        role: targetUser.role,
      };
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
  }

  async updateProfile(
    user: AuthenticatedUser,
    dto: UpdateProfileDto,
    avatarFile?: UploadedAvatarFile,
  ) {
    const currentUser = await this.findUserById(user.userId);
    const { removeAvatar, ...profileData } = dto;
    const data: Record<string, unknown> = {
      ...profileData,
    };

    if (removeAvatar && avatarFile) {
      throw new BadRequestException(
        'avatar cannot be uploaded and removed in the same request',
      );
    }

    if (removeAvatar) {
      if (currentUser.avatarPublicId) {
        await this.cloudinaryService.deleteImage(currentUser.avatarPublicId);
      }

      data.avatarUrl = null;
      data.avatarPublicId = null;
    } else if (avatarFile) {
      const uploadedAvatar = await this.cloudinaryService.uploadAvatar(
        avatarFile.buffer,
        avatarFile.mimetype,
        user.userId,
      );

      if (currentUser.avatarPublicId) {
        await this.cloudinaryService.deleteImage(currentUser.avatarPublicId);
      }

      data.avatarUrl = uploadedAvatar.url;
      data.avatarPublicId = uploadedAvatar.publicId;
    }

    return this.prisma.user.update({
      where: { id: user.userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
    });
  }

  async deleteCurrentAccount(
    user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const currentUser = await this.findUserById(user.userId);

    if (currentUser.avatarPublicId) {
      await this.cloudinaryService.deleteImage(currentUser.avatarPublicId);
    }

    await this.prisma.user.delete({
      where: { id: user.userId },
    });

    return {
      message: 'Account deleted successfully.',
    };
  }
}
