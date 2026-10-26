// The orders API. The server holds 100,000 orders; fetchOrders() returns the
// ones from `start` to `end` (end exclusive), sorted by one column if asked,
// with the total count.
export type Order = { id: number; symbol: string; qty: number; price: number };
export type OrderSort = { key: 'id' | 'symbol' | 'qty' | 'price'; dir: 'asc' | 'desc' };

export const TOTAL = 100_000;
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOG', 'NFLX'];
const order = (i: number): Order => ({
  id: i + 1,
  symbol: SYMBOLS[i % SYMBOLS.length],
  qty: ((i * 37) % 1000) + 1,
  price: Math.round((50 + ((i * 7919) % 50_000) / 100) * 100) / 100,
});

/** Every request the server received, for its access log. */
export const requestLog: { start: number; end: number; sort?: OrderSort }[] = [];
let sorted: { by: string; orders: Order[] } | undefined;

export async function fetchOrders(start: number, end: number, sort?: OrderSort): Promise<{ rows: Order[]; total: number }> {
  requestLog.push({ start, end, sort });
  await new Promise((r) => setTimeout(r, 20)); // the network
  const from = Math.max(0, start);
  const to = Math.min(TOTAL, end);
  if (!sort) return { rows: Array.from({ length: Math.max(0, to - from) }, (_, k) => order(from + k)), total: TOTAL };
  const by = `${sort.key}:${sort.dir}`;
  if (sorted?.by !== by) {
    const all = Array.from({ length: TOTAL }, (_, i) => order(i));
    const sign = sort.dir === 'asc' ? 1 : -1;
    all.sort((a, b) => (a[sort.key] < b[sort.key] ? -sign : a[sort.key] > b[sort.key] ? sign : a.id - b.id));
    sorted = { by, orders: all };
  }
  return { rows: sorted.orders.slice(from, to), total: TOTAL };
}
