// Today's board: each stock's exchange, reference price (yesterday's close)
// and last price, in VND.
export type Stock = { id: string; exchange: 'HOSE' | 'HNX' | 'UPCOM'; ref: number; price: number };

export const stocks: Stock[] = [
  { id: 'VNM', exchange: 'HOSE', ref: 68_500, price: 73_200 },
  { id: 'FPT', exchange: 'HOSE', ref: 120_000, price: 111_600 },
  { id: 'HPG', exchange: 'HOSE', ref: 27_450, price: 27_450 },
  { id: 'SHB', exchange: 'HNX', ref: 12_300, price: 12_800 },
  { id: 'PVS', exchange: 'HNX', ref: 34_500, price: 33_900 },
  { id: 'SHS', exchange: 'HNX', ref: 16_000, price: 14_400 },
  { id: 'BSR', exchange: 'UPCOM', ref: 21_000, price: 24_100 },
];
