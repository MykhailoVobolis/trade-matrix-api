import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegistryImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaService {
    return this.prisma;
  }
}
