export type Trade = {
  id: number;
  desk: 'Equities' | 'Rates' | 'FX';
  symbol: string;
  notional: number;
};

export const trades: Trade[] = [
  { id: 1, desk: 'Equities', symbol: 'AAPL', notional: 1_250_000 },
  { id: 2, desk: 'Rates', symbol: 'UST10Y', notional: 5_000_000 },
  { id: 3, desk: 'FX', symbol: 'EURUSD', notional: 2_000_000 },
  { id: 4, desk: 'Equities', symbol: 'MSFT', notional: 750_000 },
  { id: 5, desk: 'FX', symbol: 'USDJPY', notional: 1_500_000 },
  { id: 6, desk: 'Rates', symbol: 'UST2Y', notional: 3_000_000 },
  { id: 7, desk: 'Equities', symbol: 'NVDA', notional: 500_000 },
];
