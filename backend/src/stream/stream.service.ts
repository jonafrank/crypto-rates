import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AggregationService } from '../aggregation/aggregation.service.js';

@Injectable()
export class StreamService {
  private readonly subject = new Subject<StreamEvent>();

  constructor(private readonly aggregation: AggregationService) {}

  /**
   * Observable stream of server-sent events consumed by the controller.
   *
   * Emits heartbeat/status, tick updates, and computed hourly aggregates.
   */
  get observable() {
    return this.subject.asObservable();
  }

  /**
   * Publish an incoming tick and trigger rolling aggregation.
   *
   * Also emits an `hourly` event when an updated average is available for the
   * current hour bucket of the provided symbol.
   *
   * @param symbol Trading symbol, e.g. 'ETHUSDT'
   * @param price Latest trade price
   * @param ts    Event timestamp in epoch milliseconds
   */
  publishTick(symbol: string, price: number, ts: number): void {
    this.subject.next({ type: 'tick', symbol, price, ts });
    this.aggregation.handleTick(symbol, price, ts);
    const cur = this.aggregation.getCurrentAverage(symbol);
    if (cur) this.subject.next({ type: 'hourly', symbol, hourStart: cur.hourStart, avgPrice: cur.avg, sampleCount: cur.count });
  }
}
