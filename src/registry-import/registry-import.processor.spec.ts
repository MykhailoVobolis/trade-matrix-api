import { Job } from 'bullmq';
import { RegistryImportStatus } from '@prisma/client';

jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
  OnWorkerEvent:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  Processor: () => (target: object) => target,
  WorkerHost: class {
    worker = { close: jest.fn() };
  },
}));

import { RegistryImportProcessor } from './registry-import.processor';
import { RegistryImportJobData } from './registry-import.queue';

describe('RegistryImportProcessor', () => {
  const createJob = (attemptsMade: number): Job<RegistryImportJobData> =>
    ({
      data: {
        importId: 'import-1',
        userId: 'user-1',
      },
      attemptsMade,
    }) as Job<RegistryImportJobData>;

  it('processes a queued import through the service', async () => {
    const service = {
      getImportStatus: jest.fn().mockResolvedValue(RegistryImportStatus.queued),
      processQueuedImport: jest.fn().mockResolvedValue(undefined),
      recoverStaleImports: jest.fn(),
      markQueueJobFailed: jest.fn(),
    };
    const processor = new RegistryImportProcessor(service as never);

    await processor.process(createJob(0));

    expect(service.processQueuedImport).toHaveBeenCalledWith({
      importId: 'import-1',
      userId: 'user-1',
    });
  });

  it('does not process an import that is already finished', async () => {
    const service = {
      getImportStatus: jest
        .fn()
        .mockResolvedValue(RegistryImportStatus.completed),
      processQueuedImport: jest.fn(),
      recoverStaleImports: jest.fn(),
      markQueueJobFailed: jest.fn(),
    };
    const processor = new RegistryImportProcessor(service as never);

    await processor.process(createJob(0));

    expect(service.processQueuedImport).not.toHaveBeenCalled();
  });

  it('marks the import failed after the final retry attempt', async () => {
    const processingError = new Error('temporary database error');
    const service = {
      getImportStatus: jest.fn().mockResolvedValue(RegistryImportStatus.queued),
      processQueuedImport: jest.fn().mockRejectedValue(processingError),
      recoverStaleImports: jest.fn(),
      markQueueJobFailed: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new RegistryImportProcessor(service as never);

    await expect(processor.process(createJob(2))).rejects.toThrow(
      processingError,
    );

    expect(service.markQueueJobFailed).toHaveBeenCalledWith(
      'import-1',
      'Failed to parse or persist the spreadsheet file after all retry attempts.',
    );
  });

  it('recovers stale imports during module initialization', async () => {
    const service = {
      getImportStatus: jest.fn(),
      processQueuedImport: jest.fn(),
      recoverStaleImports: jest.fn().mockResolvedValue(undefined),
      markQueueJobFailed: jest.fn(),
    };
    const processor = new RegistryImportProcessor(service as never);

    await processor.onModuleInit();

    expect(service.recoverStaleImports).toHaveBeenCalledTimes(1);
  });
});
