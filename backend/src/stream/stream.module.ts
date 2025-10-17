import { Module } from '@nestjs/common';
import { StreamController } from './stream.controller.js';
import { AggregationModule } from '../aggregation/aggregation.module.js';
import { StreamService } from './stream.service.js';

@Module({
  imports: [AggregationModule],
  controllers: [StreamController],
  providers: [StreamService],
  exports: [StreamService],
})
export class StreamModule {}
