interface StreamEvent {
  type: 'tick' | 'hourly' | 'status';
  [key: string]: unknown;
}

interface TickerTick {
  symbol: string;
  price: number;
  ts: number; // epoch ms
}

interface RollingStats {
  symbol: string;
  hourStartIso: string; // current bucket start in UTC
  sum: number;
  count: number;
}
