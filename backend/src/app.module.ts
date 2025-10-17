import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';
import { MarketDataModule } from './market-data/market-data.module.js';
import { AggregationModule } from './aggregation/aggregation.module.js';
import { StreamModule } from './stream/stream.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MarketDataModule,
    AggregationModule,
    StreamModule,
    HealthModule,
  ],
})
export class AppModule {}
