// Small, fixed data for the docs' examples: every example reads the same
// symbols, so a reader compares features, not datasets.
// A type, not an interface: it then fits GridRow's index signature.
export type Quote = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  volume: number;
};

const BASE: Omit<Quote, 'id'>[] = [
  { symbol: 'VNM', name: 'Vinamilk', sector: 'Consumer', price: 68.5, change: 1.2, volume: 1_204_000 },
  { symbol: 'FPT', name: 'FPT Corp', sector: 'Technology', price: 132, change: -0.4, volume: 860_500 },
  { symbol: 'HPG', name: 'Hoa Phat', sector: 'Materials', price: 27.35, change: 0.74, volume: 3_412_900 },
  { symbol: 'VCB', name: 'Vietcombank', sector: 'Financials', price: 91.5, change: 0.55, volume: 1_986_200 },
  { symbol: 'MWG', name: 'Mobile World', sector: 'Consumer', price: 51.4, change: -1.1, volume: 2_250_400 },
  { symbol: 'SSI', name: 'SSI Securities', sector: 'Financials', price: 33.3, change: -0.45, volume: 4_104_700 },
  { symbol: 'VIC', name: 'Vingroup', sector: 'Real estate', price: 44.15, change: -0.11, volume: 1_530_100 },
  { symbol: 'GAS', name: 'PV Gas', sector: 'Energy', price: 71.8, change: 0.3, volume: 645_800 },
  { symbol: 'MSN', name: 'Masan', sector: 'Consumer', price: 76.2, change: 2.05, volume: 1_120_300 },
  { symbol: 'TCB', name: 'Techcombank', sector: 'Financials', price: 23.9, change: 0.84, volume: 5_870_000 },
  { symbol: 'VHM', name: 'Vinhomes', sector: 'Real estate', price: 41.6, change: -0.72, volume: 2_904_600 },
  { symbol: 'POW', name: 'PV Power', sector: 'Energy', price: 12.25, change: 1.66, volume: 6_315_200 },
];

/** A fresh copy of the quotes, so one example's edits never reach another. */
export function quotes(): Quote[] {
  return BASE.map((q, i) => ({ id: i + 1, ...q }));
}
