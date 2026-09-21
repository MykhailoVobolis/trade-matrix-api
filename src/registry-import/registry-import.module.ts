import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { REGISTRY_IMPORT_QUEUE_ATTEMPTS } from './constants/registry-import.constants';
import { RegistryImportController } from './registry-import.controller';
import { RegistryImportRepository } from './registry-import.repository';
import { REGISTRY_IMPORT_QUEUE_NAME } from './registry-import.queue';
import { RegistryImportProcessor } from './registry-import.processor';
import { RegistryImportService } from './registry-import.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.getOrThrow<string>('REDIS_URL'));

        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            ...(redisUrl.username
              ? { username: decodeURIComponent(redisUrl.username) }
              : {}),
            ...(redisUrl.password
              ? { password: decodeURIComponent(redisUrl.password) }
              : {}),
            ...(redisUrl.pathname.length > 1
              ? { db: Number(redisUrl.pathname.slice(1)) }
              : {}),
            ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: REGISTRY_IMPORT_QUEUE_NAME,
      defaultJobOptions: {
        attempts: REGISTRY_IMPORT_QUEUE_ATTEMPTS,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [RegistryImportController],
  providers: [
    RegistryImportRepository,
    RegistryImportService,
    RegistryImportProcessor,
  ],
})
export class RegistryImportModule {}
