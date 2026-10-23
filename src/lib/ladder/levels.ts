// The math behind DepthLadder: a price axis on the tick grid, and the rows a
// ladder shows on it (book sizes, depth from the inside out, your orders).
// Pure functions, so they are tested on their own and the component only
// wires them to the grid.
import { roundToTick } from '../trading/bands';
import type { BookLevel, LadderOrder, LadderRow, Tick } from './types';

/** Prices compare after this rounding, so float noise in a feed
    (250.05000000001) still meets its level. Ticks finer than this would
    merge prices. */
const priceKey = (p: number): number => Math.round(p * 1e8) / 1e8;

/** The tick at `price`, or NaN when the tick (or the function's answer) is not
    a positive number: the ladder then shows no prices past that point rather
    than throwing. */
function tickAt(tick: Tick, price: number): number {
  const t = typeof tick === 'number' ? tick : tick(price);
  return t > 0 && Number.isFinite(t) ? t : Number.NaN;
}

const usable = (p: number): boolean => p > 0 && Number.isFinite(p);

/** `price` on the tick grid (nearest tick); NaN for an unusable tick. */
export function snapToTick(price: number, tick: Tick): number {
  const t = tickAt(tick, price);
  return Number.isNaN(t) || !Number.isFinite(price) ? Number.NaN : priceKey(roundToTick(price, t));
}

/** The next price up (`dir` 1) or down (-1) on the tick grid. With a tick
    table, the step down from a band's first price uses the band below
    (10,000 steps down by 10, not 50, on HOSE). NaN for an unusable tick. */
export function stepPrice(price: number, tick: Tick, dir: 1 | -1): number {
  const p = snapToTick(price, tick);
  if (Number.isNaN(p)) return p;
  const t = dir > 0 ? tickAt(tick, p) : tickAt(tick, p - Math.max(1e-9, Math.abs(p) * 1e-12));
  return Number.isNaN(t) ? t : priceKey(roundToTick(p + dir * t, t));
}

/** Up to `count` prices on the tick grid, highest first, with `center`
    (snapped) at index `Math.floor(count / 2)`. Prices at or below zero, and
    any past an unusable tick, are left out, so near zero there are fewer. */
export function ladderPrices(center: number, count: number, tick: Tick): number[] {
  const n = Math.floor(count);
  const c = snapToTick(center, tick);
  if (!(n > 0) || !usable(c)) return [];
  const mid = Math.floor(n / 2);
  const above: number[] = [];
  for (let i = 0, p = c; i < mid; i++) {
    p = stepPrice(p, tick, 1);
    if (!usable(p)) break;
    above.push(p);
  }
  const below: number[] = [];
  for (let i = mid + 1, p = c; i < n; i++) {
    p = stepPrice(p, tick, -1);
    if (!usable(p)) break;
    below.push(p);
  }
  return [...above.reverse(), c, ...below];
}

/** The best bid and best ask: the highest bid and the lowest ask with size.
    Levels with an unusable price or size are skipped. */
export function bestPrices(bids: readonly BookLevel[], asks: readonly BookLevel[]): { bid?: number; ask?: number } {
  let bid: number | undefined;
  let ask: number | undefined;
  for (const [p, s] of bids) if (s > 0 && Number.isFinite(p) && (bid === undefined || p > bid)) bid = p;
  for (const [p, s] of asks) if (s > 0 && Number.isFinite(p) && (ask === undefined || p < ask)) ask = p;
  return { bid, ask };
}

/** The middle of the spread, on the tick grid (rounded down to a tick): the
    other side's best when one side is empty; undefined for an empty book. */
export function midPrice(bids: readonly BookLevel[], asks: readonly BookLevel[], tick: Tick): number | undefined {
  const { bid, ask } = bestPrices(bids, asks);
  if (bid === undefined && ask === undefined) return undefined;
  if (bid === undefined || ask === undefined) {
    const p = snapToTick((bid ?? ask)!, tick);
    return Number.isNaN(p) ? undefined : p;
  }
  const m = (bid + ask) / 2;
  const t = tickAt(tick, m);
  return Number.isNaN(t) ? undefined : priceKey(roundToTick(m, t, 'down'));
}

/**
 * One side's sizes and depth at the window's prices, in one pass over the
 * book: levels past the window's far edge on the best side only add to a
 * running total, and only the levels inside the window are sorted. Bids run
 * best first downward (depth counts prices at or above a row), asks upward.
 */
function sideAt(levels: readonly BookLevel[], prices: readonly number[], bids: boolean) {
  const size = new Map<number, number>();
  const hi = prices[0];
  const lo = prices[prices.length - 1];
  let past = 0; // on the best side of the whole window
  const inside: [number, number][] = [];
  for (const [rawP, s] of levels) {
    if (!(s > 0) || !Number.isFinite(rawP)) continue;
    const p = priceKey(rawP);
    if (bids ? p > hi : p < lo) past += s;
    else if (p >= lo && p <= hi) {
      inside.push([p, s]);
      size.set(p, (size.get(p) ?? 0) + s);
    }
  }
  // Walk the window from the best side, adding each level as it is passed.
  inside.sort((x, y) => (bids ? y[0] - x[0] : x[0] - y[0]));
  const depth = new Map<number, number>();
  let run = past;
  let j = 0;
  const walk = bids ? prices : [...prices].reverse();
  for (const p of walk) {
    while (j < inside.length && (bids ? inside[j][0] >= p : inside[j][0] <= p)) run += inside[j++][1];
    depth.set(p, run);
  }
  return { size, depth };
}

/** What `ladderRows` shows on the prices. */
export interface LadderRowsInput {
  bids: readonly BookLevel[];
  asks: readonly BookLevel[];
  orders?: readonly LadderOrder[];
  last?: number;
  /** The price text of each row. Default: the price as a string. */
  format?: (price: number) => string;
}

/** The ladder's rows at `prices` (highest first, as `ladderPrices` gives
    them). Depth is shown from the best price outward only (a bid's below
    the best bid, an ask's above the best ask), so spread rows carry none. */
export function ladderRows(prices: readonly number[], input: LadderRowsInput): LadderRow[] {
  if (prices.length === 0) return [];
  const { bids, asks, orders = [], last, format = String } = input;
  const b = sideAt(bids, prices, true);
  const a = sideAt(asks, prices, false);
  const best = bestPrices(bids, asks);
  const bestBid = best.bid === undefined ? undefined : priceKey(best.bid);
  const bestAsk = best.ask === undefined ? undefined : priceKey(best.ask);
  const mine = new Map<number, { buy: number; sell: number }>();
  for (const o of orders) {
    if (!(o.qty > 0) || !Number.isFinite(o.price)) continue;
    const k = priceKey(o.price);
    const m = mine.get(k) ?? { buy: 0, sell: 0 };
    m[o.side] += o.qty;
    mine.set(k, m);
  }
  const lastKey = last === undefined ? undefined : priceKey(last);
  const rows = prices.map((price): LadderRow => {
    const k = priceKey(price);
    const m = mine.get(k);
    const inBids = bestBid !== undefined && k <= bestBid;
    const inAsks = bestAsk !== undefined && k >= bestAsk;
    return {
      id: k,
      price: k,
      text: format(k),
      bid: b.size.get(k),
      ask: a.size.get(k),
      bidDepth: inBids ? b.depth.get(k) : undefined,
      askDepth: inAsks ? a.depth.get(k) : undefined,
      myBid: m?.buy || undefined,
      myAsk: m?.sell || undefined,
      zone: inAsks ? 'ask' : inBids ? 'bid' : 'spread',
      bestBid: k === bestBid,
      bestAsk: k === bestAsk,
      last: k === lastKey,
    };
  });
  // One scale for both sides, so a lopsided book looks lopsided.
  let deepest = 0;
  for (const r of rows) deepest = Math.max(deepest, r.bidDepth ?? 0, r.askDepth ?? 0);
  if (deepest > 0) {
    for (const r of rows) {
      if (r.bidDepth !== undefined) r.bidShare = r.bidDepth / deepest;
      if (r.askDepth !== undefined) r.askShare = r.askDepth / deepest;
    }
  }
  return rows;
}

/** Your orders resting at `price`, on one side or both. */
export function ordersAt(orders: readonly LadderOrder[], price: number, side?: 'buy' | 'sell'): LadderOrder[] {
  const k = priceKey(price);
  return orders.filter((o) => priceKey(o.price) === k && (side === undefined || o.side === side));
}
