import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';


@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  /**
   * Map of symbol to rolling statistics.
   * Key is the symbol, value is the rolling statistics
   * We store the rolling statistics in memory because it's faster than writing to the database.
   * Further improvements could be handle this on Redis or Kafka for distributed computing.
   */
  private readonly statsBySymbol = new Map<string, RollingStats>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update rolling hourly statistics with a new tick.
   *
   * Switches to a new hour bucket when the timestamp crosses the hour boundary
   * and flushes the previous bucket to persistent storage.
   */
  handleTick(symbol: string, price: number, tsMs: number): void {
    const hourStart = this.getHourBucketStart(new Date(tsMs));
    const hourStartIso = hourStart.toISOString();
    const current = this.statsBySymbol.get(symbol);
    if (!current || current.hourStartIso !== hourStartIso) {
      if (current && current.count > 0) {
        void this.flush(symbol, current);
      }
      this.statsBySymbol.set(symbol, { symbol, hourStartIso, sum: price, count: 1 });
      return;
    }
    current.sum += price;
    current.count += 1;
  }

  /**
   * Return the current in-memory average for a symbol's active hour bucket.
   * Returns null if no samples have been recorded in the current bucket.
   */
  getCurrentAverage(symbol: string): { symbol: string; hourStart: string; avg: number; count: number } | null {
    const s = this.statsBySymbol.get(symbol);
    if (!s || s.count === 0) return null;
    return { symbol, hourStart: s.hourStartIso, avg: s.sum / s.count, count: s.count };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  /**
   * Periodic job that flushes any closed hour buckets to the database and
   * rolls the in-memory window forward to the current hour.
   */
  async flushClosedHours(): Promise<void> {
    const now = new Date();
    for (const [symbol, s] of this.statsBySymbol.entries()) {
      const bucket = new Date(s.hourStartIso);
      const nextHour = new Date(bucket);
      nextHour.setUTCMinutes(60, 0, 0);
      if (now >= nextHour && s.count > 0) {
        await this.flush(symbol, s);
        this.statsBySymbol.set(symbol, {
          symbol,
          hourStartIso: this.getHourBucketStart(now).toISOString(),
          sum: 0,
          count: 0,
        });
      }
    }
  }

  /**
   * Persist the aggregate for an hour bucket via upsert and log the result.
   */
  private async flush(symbol: string, s: RollingStats): Promise<void> {
    const avg = s.sum / s.count;
    try {
      await (this.prisma as any).rateHourly.upsert({
        where: { symbol_hourStart: { symbol, hourStart: new Date(s.hourStartIso) } },
        update: { avgPrice: avg, sampleCount: s.count },
        create: { symbol, hourStart: new Date(s.hourStartIso), avgPrice: avg, sampleCount: s.count },
      });
      this.logger.log(`Flushed hourly average ${symbol} ${s.hourStartIso} avg=${avg.toFixed(6)} count=${s.count}`);
    } catch (e) {
      this.logger.error('Failed to flush hourly aggregate', e as Error);
    }
  }

  /**
   * Normalize a Date to the start of the UTC hour.
   */
  private getHourBucketStart(d: Date): Date {
    const utc = new Date(d);
    utc.setUTCMinutes(0, 0, 0);
    return utc;
  }
}
