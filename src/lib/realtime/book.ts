// An order book from a market-data feed: a snapshot, then the levels that
// changed (size 0 removes one), read back as the best levels a side, merged
// into price buckets on request, and as rows for the grid.
//
//   const book = createOrderBook();
//   book.snapshot({ bids, asks, seq });                 // e.g. from REST
//   ws.onmessage = (m) => {
//     if (book.update({ bids: m.b, asks: m.a, from: m.U, seq: m.u }) === 'gap') resync();
//   };
//   // Once a frame, not once a message:
//   if (book.version !== seen) {
//     seen = book.version;
//     rows = book.rows(20, { group: 0.5 });             // asks above bids
//   }
//   <Grid {rows} rowClass={(r) => r.side} ... />
//
// Each side is kept sorted with its best price last, so the levels a feed
// changes most (those near the spread) are found by binary search and moved
// at the cheap end of the array. Updates apply as they arrive; the reading
// is what a frame pays for.
import type { GridRow } from '../grid/column';
import type { BookLevel } from '../ladder/types';
import { boError } from '../errors';

export type { BookLevel };

/** A level as a feed sends it: `[price, size]`, as numbers or as numeric
    strings. */
export type BookLevelInput = readonly [price: number | string, size: number | string];

/** Changed levels from the feed, or a whole book for `snapshot`. */
export interface OrderBookUpdate {
  bids?: Iterable<BookLevelInput>;
  asks?: Iterable<BookLevelInput>;
  /** The feed's sequence number for this update (its last, when it covers a
      range). An update that is not newer than the last one applied is
      dropped as stale: it predates the snapshot, or repeats. */
  seq?: number;
  /** The first sequence number this update covers, when the feed numbers its
      updates in an unbroken run. Past the one after the last applied, an
      update was missed: `update` returns `'gap'` and applies nothing, so take
      a new snapshot. Leave it out and gaps go unnoticed. */
  from?: number;
}

/** What `update` did: applied it, dropped it as stale, or found a gap. */
export type BookUpdateResult = 'applied' | 'stale' | 'gap';

export interface OrderBookOptions {
  /** Read at most this many levels a side: the far ones are dropped (in
      batches, so the book may briefly hold a few more). A feed that never
      removes far levels cannot then grow the book without end. Dropped
      levels come back only with the next snapshot, so keep it well above the
      depth you show, or snapshot now and then. */
  maxLevels?: number;
}

export interface BookReadOptions {
  /** Merge levels into buckets of this size (bids rounded down, asks up, so
      the sides never meet in one): 0.5, 1, 10. Ignored unless a positive
      number. */
  group?: number;
}

/** The best levels of each side, best first. */
export interface BookTop {
  bids: BookLevel[];
  asks: BookLevel[];
}

/** A row of a stacked book: asks above, farthest first, then bids. */
export interface BookRow extends GridRow {
  side: 'bid' | 'ask';
  price: number;
  size: number;
  /** Size at this price and every better one on its side: depth from the
      spread outward. */
  total: number;
  /** `total` as a share (0–1) of the deeper side over the rows given: the
      length of a depth bar, on one scale for both sides. */
  share: number;
  /** The best bid or the best ask. */
  best: boolean;
}

/** A row of a side-by-side book: the nth bid beside the nth ask. */
export interface BookPairRow extends GridRow {
  bidPrice?: number;
  bidSize?: number;
  bidTotal?: number;
  bidShare?: number;
  askPrice?: number;
  askSize?: number;
  askTotal?: number;
  askShare?: number;
}

export interface OrderBook {
  /** Replaces the whole book, whatever its `seq`. */
  snapshot(book: OrderBookUpdate): void;
  /** Applies changed levels: a size above 0 sets a level, 0 (or below)
      removes it. Levels whose price or size is not a finite number (after
      reading a numeric string) are skipped. */
  update(changes: OrderBookUpdate): BookUpdateResult;
  /** Up to `n` levels a side, best first. */
  top(n: number, opts?: BookReadOptions): BookTop;
  /** Up to `n` levels a side as stacked rows: asks (farthest first), then
      bids. A level keeps its row id while it stays in the book (per
      grouping), so a size column's `flash: 'auto'` flashes only the levels
      that changed. */
  rows(n: number, opts?: BookReadOptions): BookRow[];
  /** Up to `n` rows of the nth bid beside the nth ask; row ids are the
      depth, 0 at the spread, so a row's level changes as the book moves:
      flash these columns by value only if that is what you want. */
  pairs(n: number, opts?: BookReadOptions): BookPairRow[];
  /** The best bid and ask; either is missing while its side is empty. */
  best(): { bid?: number; ask?: number };
  /** The best bid is at or above the best ask: updates were missed, so take
      a new snapshot. */
  readonly crossed: boolean;
  /** Levels on each side. */
  readonly levels: { bids: number; asks: number };
  /** Bumps on every change a read can see. */
  readonly version: number;
  /** The last sequence number applied, if any. */
  readonly seq: number | undefined;
  /** Empties the book and forgets the sequence. */
  clear(): void;
}

/** Prices compare after this rounding, as the ladder's do, so float noise in
    a feed (99.90000000001) still meets its level. Prices finer than 1e-8
    merge: scale such a book before it comes in. */
const priceKey = (p: number): number => Math.round(p * 1e8) / 1e8;

/** The bucket of `group` a price falls in: rounded down for a bid, up for
    an ask. A price a whole number of buckets away up to float noise
    (250.1 / 0.1 = 2500.9999999999995) counts as that whole number. */
function bucketOf(price: number, group: number, down: boolean): number {
  const raw = price / group;
  const whole = Math.round(raw);
  const units = Math.abs(raw - whole) <= 1e-9 ? whole : raw;
  return priceKey((down ? Math.floor(units) : Math.ceil(units)) * group);
}

/** Row ids kept a side per grouping before the far ones are dropped. */
const MAX_IDS = 4096;

interface Side {
  /** 1 for bids, -1 for asks: keys are `sign * price`, ascending, so the
      best price is last on both sides. */
  sign: 1 | -1;
  keys: number[];
  sizes: number[];
  /** Row ids by price, per grouping (0 for none). */
  ids: Map<number, Map<number, number>>;
}

const num = (x: number | string): number => (typeof x === 'number' ? x : x.trim() === '' ? Number.NaN : Number(x));
const finiteOrUndefined = (x: number | undefined): number | undefined => (x !== undefined && Number.isFinite(x) ? x : undefined);

/** Sets (size above 0) or removes one level, holding a side to `max` levels
    plus `slack` (dropped in a batch once it fills). Whether a read can see
    the change: one past the best `max` levels cannot. */
function setLevel(side: Side, price: number, size: number, max: number, slack: number): boolean {
  const { keys, sizes } = side;
  const k = side.sign * price;
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid] < k) lo = mid + 1;
    else hi = mid;
  }
  const found = lo < keys.length && keys[lo] === k;
  // Levels better than this one.
  const better = keys.length - lo - (found ? 1 : 0);
  const seen = better < max;
  if (size > 0) {
    if (found) {
      if (sizes[lo] === size) return false;
      sizes[lo] = size;
      return seen;
    }
    if (!seen && keys.length >= max + slack) return false; // past the far edge
    keys.splice(lo, 0, k);
    sizes.splice(lo, 0, size);
    if (keys.length > max + slack) {
      keys.splice(0, keys.length - max);
      sizes.splice(0, sizes.length - max);
    }
    return seen;
  }
  if (!found) return false;
  keys.splice(lo, 1);
  sizes.splice(lo, 1);
  return seen;
}

function fill(side: Side, levels: Iterable<BookLevelInput> | undefined, max: number): void {
  const by = new Map<number, number>();
  for (const [rawP, rawS] of levels ?? []) {
    const p = num(rawP);
    const s = num(rawS);
    if (!Number.isFinite(p) || !Number.isFinite(s)) continue;
    if (s > 0) by.set(priceKey(p), s);
    else by.delete(priceKey(p));
  }
  const keys = [...by.keys()].map((p) => side.sign * p).sort((a, b) => a - b);
  side.keys = keys.length > max ? keys.slice(keys.length - max) : keys;
  side.sizes = side.keys.map((k) => by.get(side.sign * k)!);
}

/** Up to `n` levels of one side, best first, merged into buckets of
    `group`, reading no further than the best `max` levels. */
function sideTop(side: Side, n: number, group: number | undefined, max: number): [number, number][] {
  const out: [number, number][] = [];
  const bids = side.sign > 0;
  const end = Math.max(0, side.keys.length - max);
  // The bucket being filled. A level still inside it needs no rounding, so
  // a wide bucket rounds once rather than once per level.
  let edge: number | undefined;
  for (let i = side.keys.length - 1; i >= end; i--) {
    const p = side.sign * side.keys[i] || 0;
    let at = p;
    if (group !== undefined) {
      at = edge !== undefined && (bids ? p >= edge : p <= edge) ? edge : (edge = bucketOf(p, group, bids));
    }
    const last = out[out.length - 1];
    if (last !== undefined && last[0] === at) last[1] += side.sizes[i];
    else if (out.length < n) out.push([at, side.sizes[i]]);
    else break;
  }
  return out;
}

/** Running totals from the best level outward. */
function totals(levels: readonly BookLevel[]): number[] {
  let run = 0;
  return levels.map(([, size]) => (run += size));
}

export function createOrderBook(opts: OrderBookOptions = {}): OrderBook {
  const maxLevels = opts.maxLevels ?? Number.POSITIVE_INFINITY;
  if (!(maxLevels === Number.POSITIVE_INFINITY || (Number.isInteger(maxLevels) && maxLevels > 0))) {
    throw boError(RangeError, 'BG2002', `createOrderBook: maxLevels must be a whole number above 0, got ${maxLevels}.`, 'Pass a whole number, e.g. maxLevels: 20, or leave it out to keep every level.');
  }
  // Levels past the cap kept until a batch is dropped: trimming the far end
  // shifts the whole array, so it happens once a quarter of the cap fills.
  const slack = Math.ceil(maxLevels / 4);
  const bids: Side = { sign: 1, keys: [], sizes: [], ids: new Map() };
  const asks: Side = { sign: -1, keys: [], sizes: [], ids: new Map() };
  let version = 0;
  let seq: number | undefined;
  let nextId = 1;

  const bestOf = (side: Side): number | undefined => {
    const k = side.keys[side.keys.length - 1];
    return k === undefined ? undefined : side.sign * k || 0;
  };

  const groupOf = (o: BookReadOptions | undefined): number | undefined => {
    const g = o?.group;
    return g !== undefined && g > 0 && Number.isFinite(g) ? g : undefined;
  };

  function top(n: number, o?: BookReadOptions): BookTop {
    const count = n > 0 ? Math.floor(n) : 0;
    const group = groupOf(o);
    return { bids: sideTop(bids, count, group, maxLevels), asks: sideTop(asks, count, group, maxLevels) };
  }

  /** Row ids for `shown` on `side` under `group`, made the first time a
      price is asked for. Past MAX_IDS, the ids of the best levels in the
      book (and those just shown) are kept and the rest dropped, so a level
      on any screen of up to MAX_IDS / 2 rows keeps its id. */
  function idsFor(side: Side, group: number | undefined, shown: readonly BookLevel[]): number[] {
    const g = group ?? 0;
    let ids = side.ids.get(g);
    if (ids === undefined) side.ids.set(g, (ids = new Map()));
    const out = shown.map(([p]) => {
      let id = ids.get(p);
      if (id === undefined) ids.set(p, (id = nextId++));
      return id;
    });
    if (ids.size > MAX_IDS) {
      const keep = new Map<number, number>();
      for (const [p] of sideTop(side, MAX_IDS / 2, group, maxLevels)) {
        const id = ids.get(p);
        if (id !== undefined) keep.set(p, id);
      }
      shown.forEach(([p], i) => keep.set(p, out[i]));
      side.ids.set(g, keep);
    }
    return out;
  }

  return {
    snapshot(book) {
      fill(bids, book.bids, maxLevels);
      fill(asks, book.asks, maxLevels);
      seq = finiteOrUndefined(book.seq);
      version++;
    },
    update(changes) {
      const at = finiteOrUndefined(changes.seq);
      const from = finiteOrUndefined(changes.from);
      if (seq !== undefined) {
        if (at !== undefined && !(at > seq)) return 'stale';
        if (from !== undefined && from > seq + 1) return 'gap';
      }
      let changed = false;
      for (const [side, levels] of [
        [bids, changes.bids],
        [asks, changes.asks],
      ] as const) {
        if (!levels) continue;
        for (const [rawP, rawS] of levels) {
          const p = num(rawP);
          const s = num(rawS);
          if (Number.isFinite(p) && Number.isFinite(s) && setLevel(side, priceKey(p), s, maxLevels, slack)) changed = true;
        }
      }
      if (at !== undefined) seq = at;
      if (changed) version++;
      return 'applied';
    },
    top,
    rows(n, o) {
      const group = groupOf(o);
      const t = top(n, o);
      const bidTotals = totals(t.bids);
      const askTotals = totals(t.asks);
      const bidIds = idsFor(bids, group, t.bids);
      const askIds = idsFor(asks, group, t.asks);
      const deepest = Math.max(bidTotals[bidTotals.length - 1] ?? 0, askTotals[askTotals.length - 1] ?? 0);
      const row = (side: 'bid' | 'ask', [price, size]: BookLevel, total: number, id: number, i: number): BookRow => ({
        id,
        side,
        price,
        size,
        total,
        share: deepest > 0 ? total / deepest : 0,
        best: i === 0,
      });
      const out: BookRow[] = [];
      for (let i = t.asks.length - 1; i >= 0; i--) out.push(row('ask', t.asks[i], askTotals[i], askIds[i], i));
      for (let i = 0; i < t.bids.length; i++) out.push(row('bid', t.bids[i], bidTotals[i], bidIds[i], i));
      return out;
    },
    pairs(n, o) {
      const t = top(n, o);
      const bidTotals = totals(t.bids);
      const askTotals = totals(t.asks);
      const deepest = Math.max(bidTotals[bidTotals.length - 1] ?? 0, askTotals[askTotals.length - 1] ?? 0);
      const share = (total: number | undefined): number | undefined => (total === undefined ? undefined : deepest > 0 ? total / deepest : 0);
      const out: BookPairRow[] = [];
      for (let i = 0; i < Math.max(t.bids.length, t.asks.length); i++) {
        out.push({
          id: i,
          bidPrice: t.bids[i]?.[0],
          bidSize: t.bids[i]?.[1],
          bidTotal: bidTotals[i],
          bidShare: share(bidTotals[i]),
          askPrice: t.asks[i]?.[0],
          askSize: t.asks[i]?.[1],
          askTotal: askTotals[i],
          askShare: share(askTotals[i]),
        });
      }
      return out;
    },
    best() {
      const out: { bid?: number; ask?: number } = {};
      const bid = bestOf(bids);
      const ask = bestOf(asks);
      if (bid !== undefined) out.bid = bid;
      if (ask !== undefined) out.ask = ask;
      return out;
    },
    get crossed() {
      const bid = bestOf(bids);
      const ask = bestOf(asks);
      return bid !== undefined && ask !== undefined && bid >= ask;
    },
    get levels() {
      return { bids: Math.min(bids.keys.length, maxLevels), asks: Math.min(asks.keys.length, maxLevels) };
    },
    get version() {
      return version;
    },
    get seq() {
      return seq;
    },
    clear() {
      bids.keys = [];
      bids.sizes = [];
      asks.keys = [];
      asks.sizes = [];
      seq = undefined;
      version++;
    },
  };
}
