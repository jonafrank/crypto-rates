import { StreamService } from './stream.service';

class AggregationStub {
  lastSymbol: string | null = null;
  getCurrentAverage(symbol: string) {
    return { symbol, hourStart: new Date(0).toISOString(), avg: 123.45, count: 1 };
  }
  handleTick(symbol: string, _price: number, _ts: number) {
    this.lastSymbol = symbol;
  }
}

describe('StreamService', () => {
  it('emits tick and hourly events on publishTick', async () => {
    const agg = new AggregationStub();
    // @ts-expect-error stub injection
    const svc = new StreamService(agg);

    const received: any[] = [];
    const sub = svc.observable.subscribe((e: any) => received.push(e));

    svc.publishTick('ETHUSDT', 100, 1);

    sub.unsubscribe();
    expect(received.find((e) => e.type === 'tick')).toBeTruthy();
    expect(received.find((e) => e.type === 'hourly')).toBeTruthy();
  });
});
