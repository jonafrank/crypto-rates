import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Connect the Prisma client when the Nest module initializes. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Disconnect the Prisma client during module teardown. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
