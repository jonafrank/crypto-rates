import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StreamService } from '../stream/stream.service.js';


@Injectable()
/**
 * Connects to Finnhub's WebSocket, subscribes to configured symbols, and
 * forwards normalized ticks into the streaming/aggregation pipeline.
 *
 * Handles reconnection with exponential backoff and logs connection lifecycle
 * events and parsing errors for observability.
 */
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private reconnecting = false;
  private closed = false;
  private ws: WebSocket | null = null;
  private readonly apiKey = process.env.FINNHUB_API_KEY || '';
  private readonly symbols: string[] = (process.env.FINNHUB_SYMBOLS || 'BINANCE:ETHUSDT,BINANCE:ETHUSDC,BINANCE:ETHBTC')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  constructor(private readonly stream: StreamService) {}

  /** Initialize the WS connection if an API key is present. */
  async onModuleInit(): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('FINNHUB_API_KEY not set; market data will not connect');
      return;
    }
    await this.connect();
  }

  /** Close the WS connection on shutdown if it is open. */
  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }

  /**
   * Establish a WebSocket connection to Finnhub and wire event handlers for
   * open/message/close/error to subscribe, parse, and forward ticks.
   */
  private async connect(): Promise<void> {
    const { WebSocket } = await import('ws');
    const url = `wss://ws.finnhub.io?token=${this.apiKey}`;
    this.logger.log(`Connecting to Finnhub WS: ${url}`);
    const ws = new WebSocket(url);
    this.ws = ws as unknown as WebSocket;

    ws.on('open', () => {
      this.logger.log('Finnhub WS connected');
      this.symbols.forEach((sym) => ws.send(JSON.stringify({ type: 'subscribe', symbol: sym })));
    });

    ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(String(data));
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          for (const t of msg.data) {
            if (typeof t.p === 'number' && typeof t.s === 'string' && typeof t.t === 'number') {
              const symbol = this.normalizeSymbol(t.s);
              this.stream.publishTick(symbol, t.p, t.t);
            }
          }
        }
      } catch (err) {
        this.logger.error('Error parsing WS message', err as Error);
      }
    });

    const handleCloseOrError = (ev?: unknown) => {
      if (this.closed) return;
      this.logger.warn(`Finnhub WS closed/error; scheduling reconnect: ${String(ev)}`);
      this.scheduleReconnect();
    };

    ws.on('close', handleCloseOrError);
    ws.on('error', handleCloseOrError);
  }

  /** Schedule a reconnect attempt with capped exponential backoff. */
  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    let attempt = 0;
    const tryReconnect = async () => {
      if (this.closed) return;
      const backoffMs = Math.min(30000, 1000 * 2 ** attempt);
      setTimeout(async () => {
        if (this.closed) return;
        attempt += 1;
        try {
          await this.connect();
          this.reconnecting = false;
        } catch (e) {
          this.logger.error('Reconnect attempt failed', e as Error);
          tryReconnect();
        }
      }, backoffMs);
    };
    tryReconnect();
  }

  /** Convert a provider symbol like 'BINANCE:ETHUSDT' to 'ETHUSDT'. */
  private normalizeSymbol(s: string): string {
    const idx = s.indexOf(':');
    return idx >= 0 ? s.slice(idx + 1) : s;
  }
}
