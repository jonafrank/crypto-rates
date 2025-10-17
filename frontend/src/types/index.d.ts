interface StreamEventBase { type: string }

interface TickEvent extends StreamEventBase {
  type: 'tick';
  symbol: string;
  price: number;
  ts: number;
}

interface HourlyEvent extends StreamEventBase {
  type: 'hourly';
  symbol: string;
  hourStart: string;
  avgPrice: number;
  sampleCount: number;
}

interface StatusEvent extends StreamEventBase {
  type: 'status';
  ok: boolean;
}
