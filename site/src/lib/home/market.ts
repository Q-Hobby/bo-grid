// A small simulated market for the home page: twelve symbols that random-walk
// on a tick grid, with a bid / ask around the last price and a candle trail.
import type { Candle } from 'bo-grid';

export interface MarketRow {
  [key: string]: unknown;
  id: number;
  sym: string;
  name: string;
  last: number;
  open: number;
  chg: number;
  pct: number;
  bid: number;
  ask: number;
  vol: number;
  trend: Candle[];
}

const SEED: Array<[string, string, number]> = [
  ['NVDA', 'Nvidia', 131.42],
  ['AAPL', 'Apple', 228.15],
  ['MSFT', 'Microsoft', 417.8],
  ['TSLA', 'Tesla', 251.06],
  ['AMZN', 'Amazon', 187.33],
  ['META', 'Meta', 571.9],
  ['GOOG', 'Alphabet', 164.21],
  ['AMD', 'AMD', 154.47],
  ['NFLX', 'Netflix', 707.62],
  ['AVGO', 'Broadcom', 172.85],
  ['JPM', 'JPMorgan', 222.4],
  ['XOM', 'Exxon', 117.93],
];

let seed = 0x5eed;
/** Deterministic noise, so the pre-rendered page and the first frames agree. */
export function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const cents = (n: number) => Math.round(n * 100) / 100;

function trail(start: number): Candle[] {
  const out: Candle[] = [];
  let px = start * (0.97 + rand() * 0.02);
  for (let i = 0; i < 40; i++) {
    const open = px;
    px = cents(px * (1 + (rand() - 0.47) * 0.012));
    out.push({ open, close: px, high: Math.max(open, px) * 1.002, low: Math.min(open, px) * 0.998, volume: 0 });
  }
  return out;
}

export function marketRows(): MarketRow[] {
  return SEED.map(([sym, name, open], id) => {
    const trend = trail(open);
    const last = trend[trend.length - 1].close;
    return { id, sym, name, open, last, chg: cents(last - open), pct: ((last - open) / open) * 100, bid: cents(last - 0.01), ask: cents(last + 0.01), vol: Math.floor(2e6 + rand() * 4e7), trend };
  });
}

/** One move for a row: the next last price and the fields it changes. */
export function tick(row: MarketRow): Partial<MarketRow> {
  const last = cents(Math.max(1, row.last + (Math.round((rand() - 0.49) * 6) || 1) * 0.01 * Math.max(1, row.last / 100)));
  const spread = 0.01 * (1 + Math.floor(rand() * 3));
  const trend = row.trend.slice(1);
  const prev = row.trend[row.trend.length - 1].close;
  trend.push({ open: prev, close: last, high: Math.max(prev, last), low: Math.min(prev, last), volume: 0 });
  return { last, chg: cents(last - row.open), pct: ((last - row.open) / row.open) * 100, bid: cents(last - spread), ask: cents(last + spread), vol: row.vol + Math.floor(rand() * 900) * 100, trend };
}
