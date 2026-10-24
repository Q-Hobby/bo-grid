import { describe, expect, it } from 'vitest';
import { createOrderBook } from './book';

const book20 = () => {
  const book = createOrderBook();
  book.snapshot({
    bids: [
      [99.9, 5],
      [100, 10],
      [99.8, 7],
    ],
    asks: [
      [100.2, 4],
      [100.1, 8],
      [100.3, 6],
    ],
  });
  return book;
};

describe('createOrderBook: snapshot and updates', () => {
  it('reads each side back best first', () => {
    const { bids, asks } = book20().top(10);
    expect(bids).toEqual([
      [100, 10],
      [99.9, 5],
      [99.8, 7],
    ]);
    expect(asks).toEqual([
      [100.1, 8],
      [100.2, 4],
      [100.3, 6],
    ]);
  });

  it('keeps the last of a repeated level in a snapshot and skips levels it cannot use', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: [
        [100, 1],
        [100, 3],
        [Number.NaN, 5],
        [99, Number.NaN],
        [98, 0],
        [97, Number.POSITIVE_INFINITY],
      ],
    });
    expect(book.top(10).bids).toEqual([[100, 3]]);
    expect(book.top(10).asks).toEqual([]);
  });

  it('changes, adds and removes levels; size 0 removes', () => {
    const book = book20();
    book.update({
      bids: [
        [100, 12],
        [99.9, 0],
        [100.05, 2],
      ],
      asks: [[100.1, 0]],
    });
    expect(book.top(10).bids).toEqual([
      [100.05, 2],
      [100, 12],
      [99.8, 7],
    ]);
    expect(book.top(10).asks).toEqual([
      [100.2, 4],
      [100.3, 6],
    ]);
    // Removing a level that is not there changes nothing.
    const v = book.version;
    book.update({ asks: [[101, 0]] });
    expect(book.version).toBe(v);
  });

  it('meets a level through float noise in the feed', () => {
    const book = book20();
    book.update({ bids: [[99.90000000001, 9]] });
    expect(book.top(10).bids).toContainEqual([99.9, 9]);
    expect(book.levels).toEqual({ bids: 3, asks: 3 });
  });

  it('drops an update that is not newer than the last sequence applied', () => {
    const book = createOrderBook();
    book.snapshot({ bids: [[100, 1]], seq: 100 });
    expect(book.seq).toBe(100);
    expect(book.update({ bids: [[100, 2]], seq: 99 })).toBe('stale');
    expect(book.update({ bids: [[100, 3]], seq: 100 })).toBe('stale');
    expect(book.top(1).bids).toEqual([[100, 1]]);
    expect(book.update({ bids: [[100, 4]], seq: 101 })).toBe('applied');
    expect(book.seq).toBe(101);
    // An update without a sequence always applies and leaves it as it was.
    expect(book.update({ bids: [[100, 5]] })).toBe('applied');
    expect(book.seq).toBe(101);
    expect(book.top(1).bids).toEqual([[100, 5]]);
  });

  it('finds a gap in an unbroken run of sequence numbers, and applies nothing', () => {
    const book = createOrderBook();
    book.snapshot({ bids: [[100, 1]], seq: 100 });
    // The first update after the snapshot may start at or before it.
    expect(book.update({ bids: [[100, 2]], from: 95, seq: 103 })).toBe('applied');
    expect(book.update({ bids: [[100, 3]], from: 104, seq: 104 })).toBe('applied');
    const v = book.version;
    expect(book.update({ bids: [[100, 9]], from: 106, seq: 107 })).toBe('gap');
    expect(book.top(1).bids).toEqual([[100, 3]]);
    expect(book.version).toBe(v);
    expect(book.seq).toBe(104);
  });

  it('ignores a sequence number that is not a finite number', () => {
    const book = createOrderBook();
    expect(book.update({ bids: [[1, 1]], seq: Number.NaN })).toBe('applied');
    expect(book.seq).toBeUndefined();
    expect(book.update({ bids: [[1, 2]], seq: 5 })).toBe('applied');
    expect(book.update({ bids: [[1, 3]], seq: 6 })).toBe('applied');
    book.snapshot({ bids: [[1, 1]], seq: Number.POSITIVE_INFINITY });
    expect(book.seq).toBeUndefined();
  });

  it('reads prices and sizes sent as numeric strings', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: [
        ['100.5', '3'],
        ['100.4', '0'],
        ['', '1'],
      ],
      asks: [['101', '2.5']],
      seq: 1,
    });
    expect(book.top(5)).toEqual({ bids: [[100.5, 3]], asks: [[101, 2.5]] });
    expect(book.update({ bids: [['100.5', '0'], ['100.6', '1']], seq: 2 })).toBe('applied');
    expect(book.top(5).bids).toEqual([[100.6, 1]]);
  });

  it('says where the best prices are, and when the book is crossed', () => {
    const book = book20();
    expect(book.best()).toEqual({ bid: 100, ask: 100.1 });
    expect(book.crossed).toBe(false);
    book.update({ bids: [[100.1, 1]] });
    expect(book.crossed).toBe(true);
    book.clear();
    expect(book.best()).toEqual({});
    expect(book.crossed).toBe(false);
    expect(book.levels).toEqual({ bids: 0, asks: 0 });
  });

  it('counts a version on every change, for a frame loop to skip work', () => {
    const book = createOrderBook();
    const v0 = book.version;
    book.snapshot({ bids: [[1, 1]] });
    const v1 = book.version;
    expect(v1).toBeGreaterThan(v0);
    book.update({ bids: [[1, 1]] }); // same size: no change
    expect(book.version).toBe(v1);
    book.update({ bids: [[1, 2]] });
    expect(book.version).toBeGreaterThan(v1);
  });

  it('reads at most maxLevels per side, dropping the far ones', () => {
    const book = createOrderBook({ maxLevels: 2 });
    book.snapshot({
      bids: [
        [100, 1],
        [99, 1],
        [98, 1],
      ],
    });
    expect(book.top(10).bids.map(([p]) => p)).toEqual([100, 99]);
    book.update({ bids: [[101, 1]] });
    expect(book.top(10).bids.map(([p]) => p)).toEqual([101, 100]);
    expect(book.levels.bids).toBe(2);
    expect(() => createOrderBook({ maxLevels: 0 })).toThrow(RangeError);
    expect(() => createOrderBook({ maxLevels: 1.5 })).toThrow(RangeError);
  });

  it('counts no change past the cap, and shows a level kept there once room opens', () => {
    const book = createOrderBook({ maxLevels: 2 });
    book.snapshot({
      bids: [
        [10, 1],
        [9, 1],
      ],
    });
    const v = book.version;
    book.update({ bids: [[1, 5]] });
    expect(book.version).toBe(v);
    expect(book.top(10).bids).toEqual([
      [10, 1],
      [9, 1],
    ]);
    book.update({ bids: [[10, 0]] });
    expect(book.version).toBeGreaterThan(v);
    expect(book.top(10).bids).toEqual([
      [9, 1],
      [1, 5],
    ]);
  });

  it('stays bounded and in order under a feed that keeps adding near the spread', () => {
    const book = createOrderBook({ maxLevels: 100 });
    for (let i = 0; i < 5000; i++) book.update({ bids: [[1000 + i, 1]] });
    expect(book.levels.bids).toBe(100);
    const prices = book.top(200).bids.map(([p]) => p);
    expect(prices).toHaveLength(100);
    expect(prices[0]).toBe(5999);
    expect(prices[99]).toBe(5900);
  });
});

describe('createOrderBook: top', () => {
  it('stops at n levels a side', () => {
    const { bids, asks } = book20().top(2);
    expect(bids).toHaveLength(2);
    expect(asks).toHaveLength(2);
    expect(book20().top(0)).toEqual({ bids: [], asks: [] });
    expect(book20().top(Number.NaN)).toEqual({ bids: [], asks: [] });
  });

  it('merges levels into buckets: bids rounded down, asks up', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: [
        [100.3, 1],
        [100.1, 2],
        [99.9, 3],
        [99.4, 4],
      ],
      asks: [
        [100.4, 5],
        [100.9, 6],
        [101.2, 7],
      ],
    });
    const { bids, asks } = book.top(10, { group: 1 });
    expect(bids).toEqual([
      [100, 3],
      [99, 7],
    ]);
    expect(asks).toEqual([
      [101, 11],
      [102, 7],
    ]);
    expect(book.top(1, { group: 1 })).toEqual({ bids: [[100, 3]], asks: [[101, 11]] });
  });

  it('buckets on a fractional step without float drift', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: [
        [250.1, 1],
        [250.15, 2],
        [250.05, 4],
      ],
      asks: [[250.2, 8]],
    });
    expect(book.top(10, { group: 0.1 }).bids).toEqual([
      [250.1, 3],
      [250, 4],
    ]);
    expect(book.top(10, { group: 0.1 }).asks).toEqual([[250.2, 8]]);
  });

  it('labels buckets of a quarter or two and a half exactly', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: [
        [1.75, 1],
        [1.5, 1],
        [1.3, 2],
      ],
      asks: [
        [10.1, 1],
        [12.4, 1],
      ],
    });
    expect(book.top(10, { group: 0.25 }).bids).toEqual([
      [1.75, 1],
      [1.5, 1],
      [1.25, 2],
    ]);
    expect(book.top(10, { group: 2.5 }).asks).toEqual([[12.5, 2]]);
  });

  it('ignores a group it cannot use', () => {
    const plain = book20().top(10);
    expect(book20().top(10, { group: 0 })).toEqual(plain);
    expect(book20().top(10, { group: Number.NaN })).toEqual(plain);
    expect(book20().top(10, { group: -1 })).toEqual(plain);
  });
});

describe('createOrderBook: rows', () => {
  it('stacks asks above bids, with depth from the spread outward on one scale', () => {
    const rows = book20().rows(10);
    expect(rows.map((r) => [r.side, r.price, r.size, r.total])).toEqual([
      ['ask', 100.3, 6, 18],
      ['ask', 100.2, 4, 12],
      ['ask', 100.1, 8, 8],
      ['bid', 100, 10, 10],
      ['bid', 99.9, 5, 15],
      ['bid', 99.8, 7, 22],
    ]);
    expect(rows.map((r) => r.share)).toEqual([18 / 22, 12 / 22, 8 / 22, 10 / 22, 15 / 22, 1]);
    expect(rows.filter((r) => r.best).map((r) => r.price)).toEqual([100.1, 100]);
  });

  it('keeps a level its row id while the book moves around it', () => {
    const book = book20();
    const before = new Map(book.rows(10).map((r) => [`${r.side}${r.price}`, r.id]));
    book.update({ bids: [[100.05, 3]], asks: [[100.1, 0]] });
    const after = book.rows(10);
    for (const r of after) {
      const was = before.get(`${r.side}${r.price}`);
      if (was !== undefined) expect(r.id).toBe(was);
    }
    expect(new Set(after.map((r) => r.id)).size).toBe(after.length);
  });

  it('never repeats an id, even when a bid and an ask share a price', () => {
    const book = book20();
    book.update({ bids: [[100.1, 1]] }); // crossed
    const rows = book.rows(10);
    expect(rows.filter((r) => r.price === 100.1)).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('keeps the id of a level on screen while it forgets thousands of others', () => {
    const book = createOrderBook();
    book.snapshot({ bids: [[90, 1]], asks: [[100.1, 5]] });
    const askId = book.rows(1)[0].id;
    // The best bid walks through 9,000 prices, each shown once: well past the
    // ids the book keeps, so it drops the ones no longer on screen.
    const seen = new Set<number>();
    for (let i = 1; i <= 9000; i++) {
      book.update({ bids: [[90 + i / 1000, 1]] });
      const [ask, bid] = book.rows(1);
      expect(ask.id).toBe(askId);
      seen.add(bid.id);
    }
    expect(seen.size).toBe(9000);
    // A level that left and came back after its id was dropped gets a new
    // one, never another level's.
    const rows = book.rows(3);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('pairs the nth bid with the nth ask for a side-by-side book', () => {
    const book = book20();
    book.update({ asks: [[100.3, 0]] });
    const rows = book.pairs(10);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: 0, bidPrice: 100, bidSize: 10, bidTotal: 10, askPrice: 100.1, askSize: 8, askTotal: 8 });
    expect(rows[2]).toMatchObject({ id: 2, bidPrice: 99.8, bidTotal: 22, bidShare: 1 });
    expect(rows[2].askPrice).toBeUndefined();
    expect(rows[1].askShare).toBe(12 / 22);
  });

  it('gives a bucket an id of its own, not the id of the level at its price', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: [
        [100, 3],
        [100.5, 4],
      ],
    });
    const plain = book.rows(5).find((r) => r.price === 100)!;
    const bucket = book.rows(5, { group: 1 }).find((r) => r.price === 100)!;
    expect(bucket.size).toBe(7);
    expect(bucket.id).not.toBe(plain.id);
    expect(book.rows(5).find((r) => r.price === 100)!.id).toBe(plain.id);
  });

  it('keeps the ids of a deep view while a shallow view of the same book churns', () => {
    const book = createOrderBook();
    book.snapshot({
      bids: Array.from({ length: 50 }, (_, i): [number, number] => [100 - i, 1]),
      asks: [[200, 1]],
    });
    const deep = new Map(book.rows(50).map((r) => [r.price, r.id]));
    for (let i = 1; i <= 6000; i++) {
      // Briefly a new best bid, shown in a one-row view, then gone.
      book.update({ bids: [[100 + i / 10_000, 1]] });
      book.rows(1);
      book.update({ bids: [[100 + i / 10_000, 0]] });
    }
    for (const r of book.rows(50)) if (deep.has(r.price)) expect(r.id).toBe(deep.get(r.price));
  });

  it('builds rows on the buckets too', () => {
    const rows = book20().rows(10, { group: 0.5 });
    expect(rows.map((r) => [r.side, r.price, r.size])).toEqual([
      ['ask', 100.5, 18],
      ['bid', 100, 10],
      ['bid', 99.5, 12],
    ]);
  });
});
