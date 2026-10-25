export type Order = {
  id: number;
  symbol: string;
  side: 'Buy' | 'Sell';
  qty: number;
  price: number;
};

export const orders: Order[] = [
  { id: 1, symbol: 'AAPL', side: 'Buy', qty: 100, price: 189.3 },
  { id: 2, symbol: 'MSFT', side: 'Sell', qty: 40, price: 415.1 },
  { id: 3, symbol: 'NVDA', side: 'Buy', qty: 300, price: 121.75 },
];
