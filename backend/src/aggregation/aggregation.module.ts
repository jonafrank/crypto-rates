import { Module } from '@nestjs/common';
import { AggregationService } from './aggregation.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [AggregationService],
  exports: [AggregationService],
})
export class AggregationModule {}
