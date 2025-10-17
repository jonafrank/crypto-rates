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
