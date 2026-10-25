export type Position = {
  symbol: string;
  qty: number;
  avg: number;
  last: number;
};

export const positions: Position[] = [
  { symbol: 'AAPL', qty: 100, avg: 180, last: 189.3 },
  { symbol: 'MSFT', qty: 50, avg: 420, last: 415.1 },
  { symbol: 'NVDA', qty: 200, avg: 110.5, last: 121.75 },
  { symbol: 'TSLA', qty: -30, avg: 250, last: 262.4 },
  { symbol: 'AMZN', qty: 80, avg: 185.2, last: 186 },
];
