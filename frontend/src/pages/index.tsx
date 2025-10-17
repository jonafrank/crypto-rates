import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SymbolCard } from '../components/SymbolCard';

const symbols: Array<{ key: string; unit: string }> = [
  { key: 'ETHUSDC', unit: 'USDC' },
  { key: 'ETHUSDT', unit: 'USDT' },
  { key: 'ETHBTC', unit: 'BTC' },
];

/**
 * Real-time dashboard that subscribes to the backend SSE stream and renders
 * a set of symbol cards with the latest price, sparkline, and hourly average.
 */
export default function Home() {
  const [latest, setLatest] = useState<Record<string, number>>({});
  const [avg, setAvg] = useState<Record<string, { hourStart: string; avgPrice: number; sampleCount: number }>>({});
  const [lastUpdateIso, setLastUpdateIso] = useState<Record<string, string>>({});
  const [conn, setConn] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const seriesRef = useRef<Record<string, number[]>>({});
  const [, force] = useState(0);
  const backendUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001', []);

  // Establish and maintain an SSE connection to the backend.
  // Implements exponential backoff reconnects and updates in-memory series.
  useEffect(() => {
    let cancelled = false;
    let retryAttempt = 0;
    let src: EventSource | null = null;

    /**
     * Opens an EventSource connection to the backend `/stream` endpoint,
     * updates connection status, parses incoming events, and schedules
     * reconnects on failures using exponential backoff.
     */
    const connect = () => {
      if (cancelled) return;
      setConn((prev) => (prev === 'connected' ? 'connected' : 'connecting'));
      src = new EventSource(`${backendUrl}/stream`);
      src.onopen = () => {
        retryAttempt = 0;
        setConn('connected');
      };
      src.onerror = () => {
        setConn('disconnected');
        if (src) { try { src.close(); } catch {} }
        const backoff = Math.min(30000, 1000 * 2 ** retryAttempt++);
        setTimeout(connect, backoff);
      };
      src.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as TickEvent | HourlyEvent | StatusEvent;
          if (data.type === 'status') { setConn('connected'); return; }
          if (data.type === 'tick') {
            setLatest((prev) => ({ ...prev, [data.symbol]: data.price }));
            setLastUpdateIso((prev) => ({ ...prev, [data.symbol]: new Date(data.ts).toISOString() }));
            const arr = seriesRef.current[data.symbol] ?? [];
            const next = [...arr, data.price].slice(-60);
            seriesRef.current[data.symbol] = next;
            force((n) => n + 1);
          } else if (data.type === 'hourly') {
            setAvg((prev) => ({ ...prev, [data.symbol]: { hourStart: data.hourStart, avgPrice: Number(data.avgPrice), sampleCount: data.sampleCount } }));
          }
        } catch {}
      };
    };

    connect();
    return () => { cancelled = true; if (src) try { src.close(); } catch {} };
  }, [backendUrl]);

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center' }}>Dashboard</h1>
      <div style={{ maxWidth: 960, margin: '8px auto 0', padding: '8px 12px', borderRadius: 8,
        background: conn === 'connected' ? '#ecfdf5' : conn === 'connecting' ? '#fff7ed' : '#fef2f2',
        color: conn === 'connected' ? '#065f46' : conn === 'connecting' ? '#9a3412' : '#991b1b',
        border: `1px solid ${conn === 'connected' ? '#10b981' : conn === 'connecting' ? '#fb923c' : '#f87171'}` }}>
        {conn === 'connected' && 'Connected to backend in real time'}
        {conn === 'connecting' && 'Connecting to backend…'}
        {conn === 'disconnected' && 'Disconnected from backend. Retrying…'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
        {symbols.map(({ key, unit }) => (
          <div key={key}>
            <SymbolCard
              title={`ETH → ${unit}`}
              unit={unit}
              series={seriesRef.current[key] ?? []}
              latestPrice={latest[key]}
              lastUpdateIso={lastUpdateIso[key]}
              hourlyAvg={avg[key]?.avgPrice}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
