import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  /**
   * Lightweight health endpoint performing a simple DB check.
   * Returns `{ db: 'ok' | 'error', ws: 'unknown' }`.
   */
  async get() {
    try {
      await (this.prisma as any).$executeRaw`SELECT 1`;
      return { db: 'ok', ws: 'unknown' };
    } catch {
      return { db: 'error', ws: 'unknown' };
    }
  }
}
