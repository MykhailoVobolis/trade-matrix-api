import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  REGISTRY_IMPORT_JOB_TIMEOUT_MS,
  REGISTRY_IMPORT_QUEUE_ATTEMPTS,
} from './constants/registry-import.constants';
import {
  REGISTRY_IMPORT_QUEUE_NAME,
  RegistryImportJobData,
} from './registry-import.queue';
import { RegistryImportService } from './registry-import.service';

@Processor(REGISTRY_IMPORT_QUEUE_NAME, {
  concurrency: 1,
  lockDuration: REGISTRY_IMPORT_JOB_TIMEOUT_MS,
  stalledInterval: 60_000,
  maxStalledCount: 1,
})
export class RegistryImportProcessor
  extends WorkerHost
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RegistryImportProcessor.name);
  private staleRecoveryTimer?: NodeJS.Timeout;

  constructor(private readonly registryImportService: RegistryImportService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.recoverStaleImports();
    this.staleRecoveryTimer = setInterval(() => {
      void this.recoverStaleImports();
    }, 60_000);
    this.staleRecoveryTimer.unref();
  }

  async process(job: Job<RegistryImportJobData>): Promise<void> {
    const importStatus = await this.registryImportService.getImportStatus(
      job.data.importId,
    );

    if (
      !importStatus ||
      importStatus === 'failed' ||
      importStatus === 'completed'
    ) {
      return;
    }

    try {
      await this.registryImportService.processQueuedImport(job.data);
    } catch (error) {
      const isFinalAttempt =
        job.attemptsMade + 1 >= REGISTRY_IMPORT_QUEUE_ATTEMPTS;

      if (isFinalAttempt) {
        await this.registryImportService.markQueueJobFailed(
          job.data.importId,
          'Failed to parse or persist the spreadsheet file after all retry attempts.',
        );
      }

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RegistryImportJobData> | undefined, error: Error): void {
    if (job) {
      this.logger.error(
        `Registry import job ${job.data.importId} failed: ${error.message}`,
      );
    } else {
      this.logger.error(`Registry import worker failed: ${error.message}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.staleRecoveryTimer) {
      clearInterval(this.staleRecoveryTimer);
    }

    await this.worker?.close();
  }

  private async recoverStaleImports(): Promise<void> {
    try {
      await this.registryImportService.recoverStaleImports();
    } catch (error) {
      this.logger.error('Failed to recover stale registry imports', error);
    }
  }
}
