## High-level architecture and data flow
- 1) Market data in → 2) Stream processing → 3) Aggregation → 4) Persistence → 5) Real-time stream out
- Flow:
  - MarketDataService connects to Finnhub WS, subscribes to symbols, parses ticks.
  - Each tick is published to `StreamService`.
  - `StreamService` forwards tick to `AggregationService` and emits events.
  - `AggregationService` maintains rolling hourly stats and periodically flushes to Postgres.
  - `StreamController` exposes an SSE endpoint that merges heartbeats and app events.

## Modules

### PrismaModule / PrismaService
- Purpose: Manage DB access and Prisma client lifecycle.
- Responsibilities:
  - Connect on `onModuleInit` and disconnect on `onModuleDestroy`.
  - Provide Prisma client to services (e.g., `AggregationService`).
- Notes: Uses `DATABASE_URL`. Prisma schema defines `"RateHourly"` with unique `(symbol, hourStart)`.

### MarketDataModule / MarketDataService
- Purpose: External market data ingestion (Finnhub WebSocket).
- Responsibilities:
  - Connect to `wss://ws.finnhub.io?token=<API_KEY>`.
  - Subscribe to configured symbols (`FINNHUB_SYMBOLS`), e.g. `BINANCE:ETHUSDT`.
  - Parse messages; for valid trades, normalize symbols (`BINANCE:ETHUSDT` → `ETHUSDT`) and publish ticks to `StreamService`.
  - Reconnection with capped exponential backoff; logs lifecycle and parsing errors.
- Config:
  - `FINNHUB_API_KEY` (required for live connection).
  - `FINNHUB_SYMBOLS` (comma-separated; defaults include ETHUSDT, ETHUSDC, ETHBTC).

### AggregationModule / AggregationService
- Purpose: Compute and persist hourly averages.
- Responsibilities:
  - `handleTick(symbol, price, tsMs)`: Update in-memory rolling stats in the symbol’s current UTC hour bucket.
  - Roll to a new hour bucket and flush the closed bucket.
  - `flushClosedHours` (cron/minute): Persist closed buckets and reset counters.
  - `getCurrentAverage(symbol)`: Expose current in-memory average for streaming.
  - Persistence via upsert into `"RateHourly"` to ensure one row per `(symbol, hourStart)`.
- Design notes:
  - In-memory `Map` keyed by `symbol`.
  - Hour buckets are UTC-aligned (minutes/seconds/millis zeroed).
  - Tradeoff: Fast and simple; on restart, current hour’s partial aggregate is rebuilt from new ticks (acceptable for this scope).

### StreamModule / StreamService / StreamController
- Purpose: Internal event bus + public real-time endpoint.
- StreamService:
  - Subject-based observable of `tick`, `hourly`, and `status` events.
  - `publishTick(symbol, price, ts)`: Emit `tick`, update `AggregationService`, and emit `hourly` if a current average is available.
- StreamController:
  - SSE endpoint `GET /stream`.
  - Merges:
    - Heartbeat every 15s (`{ type: 'status', ok: true }`).
    - Application events from `StreamService` (`tick`, `hourly`).
- Note: SSE chosen for simplicity and browser support. WebSockets would also work; the interface is abstracted.

### HealthModule / HealthController
- Purpose: Lightweight readiness probe.
- Endpoint: `GET /health` runs `SELECT 1` and returns `{ db: 'ok' | 'error', ws: 'unknown' }`.

### AppModule
- Purpose: Wiring and bootstrap.
- Imports:
  - `ConfigModule.forRoot({ isGlobal: true })` for env config.
  - `ScheduleModule.forRoot()` for the cron job in `AggregationService`.
  - Feature modules: Prisma, MarketData, Aggregation, Stream, Health.

## Persistence model (Prisma)
- Table `"RateHourly"`:
  - Columns: `id`, `symbol`, `hourStart` (UTC), `avgPrice`, `sampleCount`, `createdAt`, `updatedAt`
  - Constraints: unique `(symbol, hourStart)`
- Rationale: Upsert guarantees idempotent writes per hour per symbol.

## Real-time contract (SSE payloads)
- `status`: `{ type: 'status', ok: true }` (heartbeat)
- `tick`: `{ type: 'tick', symbol, price, ts }` (latest trade/tick)
- `hourly`: `{ type: 'hourly', symbol, hourStart, avgPrice, sampleCount }` (current hour’s running average)

## Error handling and resilience
- MarketDataService:
  - Reconnects with capped exponential backoff on `close`/`error`.
  - Logs parse errors and connection lifecycle events.
- AggregationService:
  - `flush` errors are caught and logged; aggregation continues.
- StreamController:
  - Keeps clients connected via heartbeats; frontend displays state badges.

## Configuration and ops
- Env vars:
  - Backend: `DATABASE_URL`, `FINNHUB_API_KEY`, `FINNHUB_SYMBOLS`, `CORS_ORIGIN`, `PORT`
  - Frontend: `NEXT_PUBLIC_BACKEND_URL`
- Docker Compose:
  - Services: `db`, `backend`, `frontend`
  - DB creds: user `app`, password `app`, db `crypto`
- Ports:
  - Backend: `:3001` (SSE `/stream`, `GET /health`)
  - Frontend: `:3000`

## Testing overview
- Unit tests (Vitest):
  - `AggregationService`: rolling average across hour boundaries
  - `StreamService`: event emission on tick publish
- Why Vitest:
  - ESM-first, TypeScript-friendly, fast feedback, Jest-like APIs

## Interview Q&A anchors
- Why SSE vs WebSockets:
  - Simpler server push, no client lib needed, great for uni-directional updates; WebSockets for bi-directional needs.
- Why upsert on persistence:
  - Guarantees a single row per `(symbol, hourStart)` and makes flush idempotent.
- Why in-memory aggregation:
  - Ultra-low latency and minimal write amplification; for HA, externalize state (e.g., Redis/Kafka) and run consumers.
- Hour boundary handling:
  - Normalize timestamps to UTC start-of-hour to ensure consistent bucket keys across instances.
