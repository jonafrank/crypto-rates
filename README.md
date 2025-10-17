# Crypto Rates Realtime

Two-service app streaming ETH pairs in realtime and persisting hourly averages.

## Services
- Backend: NestJS + TypeScript
- Frontend: Next.js + TypeScript
- DB: PostgreSQL 15

## Quickstart
1. Copy `.env.example` to `.env` and set `FINNHUB_API_KEY`.
2. Build and run:
   - `docker compose build`
   - `docker compose up -d`
3. Open frontend at http://localhost:3000
4. Backend health: http://localhost:3001/health

## URLs
- SSE stream: `GET http://localhost:3001/stream`

## Notes
- Aggregation stores one row per symbol per UTC hour with average and sampleCount.
- Symbols configurable via `FINNHUB_SYMBOLS`.

# Backend Architecture

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

  # Frontend Architecture
  
  ## Frontend architecture and data flow
- 1) Connect to backend SSE → 2) Parse events → 3) Update in-memory state → 4) Render cards with charts and stats
- Flow:
  - The dashboard page (`pages/index.tsx`) opens an SSE connection to `GET {NEXT_PUBLIC_BACKEND_URL}/stream`.
  - Incoming messages are JSON with `type: 'status' | 'tick' | 'hourly'`.
  - For `tick`, we update latest price, last-update timestamps, and append to an in-memory series buffer (per symbol).
  - For `hourly`, we update the displayed hourly average (per symbol).
  - UI renders a responsive grid of `SymbolCard` components, each showing a sparkline, current price, last update time, and hourly average.

## Key components and files

### `pages/index.tsx` (Dashboard)
- Purpose: Real-time dashboard that visualizes ETH pairs.
- Responsibilities:
  - Establish and maintain an EventSource (SSE) connection to the backend stream.
  - Manage connection state: `connecting` → `connected` → `disconnected` with exponential backoff reconnect.
  - Maintain in-memory series data (`useRef<Record<string, number[]>>`) to minimize re-renders.
  - Track per-symbol latest price, last update timestamp, and hourly averages in `useState`.
  - Render a grid of `SymbolCard`s for the three pairs: `ETHUSDC`, `ETHUSDT`, `ETHBTC`.
- Notes:
  - `NEXT_PUBLIC_BACKEND_URL` controls the backend hostname/port.
  - `status` events are used to drive the connection banner color and text.
  - Series arrays are capped (e.g., 60 samples) for lightweight sparklines and stable performance.

### `src/components/SymbolCard.tsx`
- Purpose: Present a compact card with a sparkline and current stats.
- Responsibilities:
  - Compute sparkline points with `useMemo` based on the series (min/max scaling, X step, Y mapping).
  - Display current price (with adaptive decimals), last update (UTC humanized), and hourly average.
  - Render a simple, responsive SVG polyline with minimal styling.
- Notes:
  - Formatting uses a small helper that picks 6 decimals for values < 1, else 2 decimals.
  - Accepts `series`, `latestPrice`, `lastUpdateIso`, `hourlyAvg`, and `unit` props.

## Real-time protocol (SSE payloads consumed by the frontend)
- `status`: `{ type: 'status', ok: true }` → sets `connected` and drives the banner.
- `tick`: `{ type: 'tick', symbol, price, ts }` → updates latest price, last-update ISO, and the series buffer.
- `hourly`: `{ type: 'hourly', symbol, hourStart, avgPrice, sampleCount }` → updates the hourly average shown on the card.

## State management choices
- Local React state is sufficient given the scope and low data volume:
  - `useState` for per-symbol latest values and averages.
  - `useRef` for series arrays to avoid frequent re-renders while still allowing the sparkline to refresh via a lightweight `force` counter.
- Rationale: Keeps dependencies minimal; global state libraries are unnecessary for this dashboard scale.

## Error handling and resilience
- Connection lifecycle:
  - `onopen` → reset backoff and mark `connected`.
  - `onerror` → mark `disconnected`, close the EventSource, schedule reconnect with capped exponential backoff.
- UI feedback:
  - A colored banner indicates `connecting`/`connected`/`disconnected` states.
  - Rendering is resilient to missing data (uses em-dash placeholders when values are not available yet).

## Performance considerations
- Sparkline computation is `useMemo`-ized by `series`.
- Series arrays are bounded (slice to last 60 points) to limit DOM and SVG path size.
- Using `useRef` for series reduces state churn; a trivial `force` counter triggers redraws only when needed.
- Layout uses a responsive CSS grid; simple inline styles keep CSS overhead low for this assessment.

## Environment and configuration
- `NEXT_PUBLIC_BACKEND_URL` (public env var) controls the SSE endpoint base URL.
- Defaults to `http://localhost:3001` for local development.
- Can be overridden without code changes, suitable for different environments.

## Testing strategy
- Framework: Vitest with Testing Library (+ `jest-dom` matchers via `vitest.setup.ts`).
- Test types:
  - Component rendering: `SymbolCard.spec.tsx` asserts presence of title, formatted price, and hourly average label.
  - Behavior tests can simulate prop changes to validate formatting and conditional rendering.
- Rationale for Vitest:
  - Fast ESM/TypeScript support, Jest-compatible APIs, consistent runner across backend and frontend in this repo.

## Accessibility and UX
- Textual labels (e.g., "1h Avg:") accompany numeric values for clarity.
- System fonts and high-contrast banner colors indicate connection state.
- SVG sparkline uses sufficient stroke width; additional a11y hooks (e.g., aria-labels) can be added depending on reviewer preference.