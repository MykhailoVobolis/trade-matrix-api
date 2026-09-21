import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  REGISTRY_IMPORT_QUEUE_NAME,
  RegistryImportJobData,
} from './registry-import.queue';
import { RegistryImportService } from './registry-import.service';

@Processor(REGISTRY_IMPORT_QUEUE_NAME, { concurrency: 1 })
export class RegistryImportProcessor extends WorkerHost {
  constructor(private readonly registryImportService: RegistryImportService) {
    super();
  }

  process(job: Job<RegistryImportJobData>): Promise<void> {
    return this.registryImportService.processQueuedImport(job.data);
  }
}
