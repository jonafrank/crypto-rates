import { AggregationService } from './aggregation.service';

class PrismaStub {
  rateHourly = {
    async upsert(_: any) {},
  } as any;
}

function createService() {
  // @ts-expect-error using stub for PrismaService
  return new AggregationService(new PrismaStub());
}

describe('AggregationService', () => {
  it('computes rolling average within same hour', () => {
    const svc = createService();
    const ts = Date.UTC(2024, 0, 1, 10, 5, 0);
    svc.handleTick('ETHUSDT', 100, ts);
    svc.handleTick('ETHUSDT', 110, ts + 1000);
    const cur = svc.getCurrentAverage('ETHUSDT');
    expect(cur).toBeTruthy();
    expect(cur?.avg).toBeCloseTo(105, 6);
    expect(cur?.count).toBe(2);
  });

  it('rolls to next hour and resets rolling stats', () => {
    const svc = createService();
    const ts1 = Date.UTC(2024, 0, 1, 10, 59, 50);
    const ts2 = Date.UTC(2024, 0, 1, 11, 0, 5);
    svc.handleTick('ETHUSDC', 200, ts1);
    svc.handleTick('ETHUSDC', 220, ts2);
    const cur = svc.getCurrentAverage('ETHUSDC');
    expect(cur).toBeTruthy();
    expect(cur?.hourStart.endsWith(':00.000Z')).toBe(true);
    expect(cur?.avg).toBeCloseTo(220, 6);
    expect(cur?.count).toBe(1);
  });
});
