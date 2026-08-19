import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

type UploadAvatarResult = {
  url: string;
  publicId: string;
};

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUD_KEY');
    const apiSecret = this.configService.get<string>('CLOUD_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  async uploadAvatar(
    fileBuffer: Buffer,
    mimeType: string,
    userId: string,
  ): Promise<UploadAvatarResult> {
    this.assertConfigured();
    const image = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(image, {
      folder: 'trade-matrix-api/avatars',
      public_id: `user-${userId}-${Date.now()}`,
      resource_type: 'image',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  async deleteImage(publicId: string): Promise<void> {
    this.assertConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });
  }

  private assertConfigured(): void {
    if (
      !this.configService.get<string>('CLOUD_NAME') ||
      !this.configService.get<string>('CLOUD_KEY') ||
      !this.configService.get<string>('CLOUD_SECRET')
    ) {
      throw new InternalServerErrorException(
        'Cloudinary configuration is missing',
      );
    }
  }
}
