import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service.js';
import { StreamModule } from '../stream/stream.module.js';

@Module({
  imports: [StreamModule],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
