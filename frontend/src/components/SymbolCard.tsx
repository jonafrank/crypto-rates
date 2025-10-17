import React from 'react';

export interface SymbolCardProps {
  title: string;
  series: number[]; // recent prices, newest at end
  latestPrice?: number;
  lastUpdateIso?: string;
  hourlyAvg?: number;
  unit?: string; // e.g. 'USDT', 'USDC', 'BTC'
}

/**
 * Formats a numeric value for display with variable precision.
 *
 * - Returns '—' for null/undefined/NaN values
 * - Uses 6 decimals for values < 1, otherwise 2 decimals
 */
function formatNumber(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const decimals = n < 1 ? 6 : 2;
  return n.toFixed(decimals);
}

/**
 * Compact card component that renders a small sparkline for a symbol along with
 * the latest price, last update timestamp, and recent hourly average.
 */
export function SymbolCard({ title, series, latestPrice, lastUpdateIso, hourlyAvg, unit }: SymbolCardProps) {
  const width = 260;
  const height = 80;
  const paddingX = 8;
  const paddingY = 8;

  const points = React.useMemo(() => {
    if (!series || series.length === 0) return '';
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const stepX = (width - paddingX * 2) / Math.max(1, series.length - 1);
    const toY = (v: number) => height - paddingY - ((v - min) / span) * (height - paddingY * 2);
    return series
      .map((v: number, i: number) => `${paddingX + i * stepX},${toY(v)}`)
      .join(' ');
  }, [series]);

  const lastUpdateText = lastUpdateIso ? new Date(lastUpdateIso).toUTCString().replace(' GMT', '') : '—';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {formatNumber(latestPrice)} {unit ?? ''}
        </div>
      </div>
      <svg width={width} height={height} style={{ display: 'block', width: '100%', maxWidth: width }}>
        <polyline
          fill="none"
          stroke="#64748b"
          strokeWidth={2}
          points={points}
        />
      </svg>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
        <div>Last update: {lastUpdateText}</div>
        <div>
          1h Avg: {formatNumber(hourlyAvg)} {unit ?? ''}
        </div>
      </div>
    </div>
  );
}
