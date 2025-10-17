import React from 'react';
import { render, screen } from '@testing-library/react';
import { SymbolCard } from './SymbolCard';

describe('SymbolCard', () => {
  it('renders title and latest price with unit', () => {
    render(
      <SymbolCard
        title="ETH → USDT"
        unit="USDT"
        series={[100, 101]}
        latestPrice={101}
        lastUpdateIso={new Date(0).toISOString()}
        hourlyAvg={100.5}
      />
    );
    expect(screen.getByText('ETH → USDT')).toBeInTheDocument();
    expect(screen.getByText(/101\.00 USDT/)).toBeInTheDocument();
    expect(screen.getByText(/1h Avg:/)).toBeInTheDocument();
  });
});
