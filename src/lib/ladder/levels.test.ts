import { describe, expect, it } from 'vitest';
import { vnTickSize } from '../trading/bands';
import { bestPrices, ladderPrices, ladderRows, midPrice, ordersAt, snapToTick, stepPrice } from './levels';
import type { BookLevel } from './types';

const hose = (p: number) => vnTickSize(p, 'HOSE');

describe('stepPrice and snapToTick', () => {
  it('steps on a fixed tick without float drift', () => {
    let p = 250;
    for (let i = 0; i < 7; i++) p = stepPrice(p, 0.05, 1);
    expect(p).toBe(250.35);
    expect(stepPrice(0.3, 0.1, -1)).toBe(0.2);
    expect(snapToTick(250.0500000001, 0.05)).toBe(250.05);
  });

  it('follows a tick table across a band edge, both ways', () => {
    expect(stepPrice(9990, hose, 1)).toBe(10000);
    expect(stepPrice(10000, hose, 1)).toBe(10050);
    expect(stepPrice(10000, hose, -1)).toBe(9990);
    expect(stepPrice(50000, hose, -1)).toBe(49950);
    expect(stepPrice(50000, hose, 1)).toBe(50100);
  });
});

describe('ladderPrices', () => {
  it('lists prices highest first with the centre in the middle', () => {
    expect(ladderPrices(250, 5, 0.05)).toEqual([250.1, 250.05, 250, 249.95, 249.9]);
    // Even counts put the centre just below the middle.
    expect(ladderPrices(250, 4, 0.05)).toEqual([250.1, 250.05, 250, 249.95]);
  });

  it('snaps the centre and steps a tick table', () => {
    expect(ladderPrices(10003, 3, hose)).toEqual([10050, 10000, 9990]);
  });

  it('is empty for no rows or no centre', () => {
    expect(ladderPrices(250, 0, 0.05)).toEqual([]);
    expect(ladderPrices(Number.NaN, 5, 0.05)).toEqual([]);
  });
});

describe('bestPrices and midPrice', () => {
  const bids: BookLevel[] = [
    [249.9, 300],
    [249.95, 100],
    [250, 0],
  ];
  const asks: BookLevel[] = [
    [250.1, 200],
    [250.05, 0],
    [250.2, 50],
  ];

  it('ignores empty levels', () => {
    expect(bestPrices(bids, asks)).toEqual({ bid: 249.95, ask: 250.1 });
  });

  it('takes the middle of the spread, rounded down to a tick', () => {
    expect(midPrice(bids, asks, 0.05)).toBe(250);
    expect(midPrice(bids, [], 0.05)).toBe(249.95);
    expect(midPrice([], [], 0.05)).toBeUndefined();
  });
});

describe('ladderRows', () => {
  const bids: BookLevel[] = [
    [249.95, 100],
    [249.9, 300],
    [249.8, 50],
  ];
  const asks: BookLevel[] = [
    [250.1, 200],
    [250.2, 50],
  ];

  it('places sizes, zones and the best prices', () => {
    const rows = ladderRows(ladderPrices(250, 7, 0.05), { bids, asks });
    expect(rows.map((r) => [r.price, r.bid ?? null, r.ask ?? null, r.zone])).toEqual([
      [250.15, null, null, 'ask'],
      [250.1, null, 200, 'ask'],
      [250.05, null, null, 'spread'],
      [250, null, null, 'spread'],
      [249.95, 100, null, 'bid'],
      [249.9, 300, null, 'bid'],
      [249.85, null, null, 'bid'],
    ]);
    expect(rows.find((r) => r.bestBid)?.price).toBe(249.95);
    expect(rows.find((r) => r.bestAsk)?.price).toBe(250.1);
  });

  it('accumulates depth from the best price outward, empty levels included', () => {
    const rows = ladderRows(ladderPrices(250, 13, 0.05), { bids, asks });
    const at = (p: number) => rows.find((r) => r.price === p)!;
    expect(at(249.95).bidDepth).toBe(100);
    expect(at(249.9).bidDepth).toBe(400);
    expect(at(249.85).bidDepth).toBe(400);
    expect(at(249.8).bidDepth).toBe(450);
    expect(at(250.1).askDepth).toBe(200);
    expect(at(250.15).askDepth).toBe(200);
    expect(at(250.2).askDepth).toBe(250);
    expect(at(250).bidDepth ?? at(250).askDepth).toBeUndefined();
  });

  it('sums your orders per price and side, and marks the last trade', () => {
    const orders = [
      { id: 'a', side: 'buy' as const, price: 249.95, qty: 10 },
      { id: 'b', side: 'buy' as const, price: 249.95, qty: 5 },
      { id: 'c', side: 'sell' as const, price: 250.1, qty: 7 },
      { id: 'd', side: 'sell' as const, price: 250.1, qty: 0 },
    ];
    const rows = ladderRows(ladderPrices(250, 7, 0.05), { bids, asks, orders, last: 250.1000000001 });
    const at = (p: number) => rows.find((r) => r.price === p)!;
    expect(at(249.95).myBid).toBe(15);
    expect(at(250.1).myAsk).toBe(7);
    expect(at(250).myBid).toBeUndefined();
    expect(at(250.1).last).toBe(true);
    expect(rows.filter((r) => r.last)).toHaveLength(1);
    expect(ordersAt(orders, 249.95).map((o) => o.id)).toEqual(['a', 'b']);
    expect(ordersAt(orders, 250.1, 'buy')).toEqual([]);
  });

  it('sums a price that repeats in the feed', () => {
    const rows = ladderRows([250], {
      bids: [],
      asks: [
        [250, 10],
        [250.00000000001, 5],
      ],
    });
    expect(rows[0].ask).toBe(15);
  });

  it('counts the book beyond the window and between its prices into depth', () => {
    const rows = ladderRows([250.1, 250.05, 250], {
      bids: [
        [250.5, 7], // above the window: in every bid row's depth
        [250.07, 3], // between two of its prices
        [250, 10],
        [249, 1000], // below the window: in none
      ],
      asks: [],
    });
    expect(rows.map((r) => r.bidDepth)).toEqual([7, 10, 20]);
    expect(rows[0].bid).toBeUndefined();
  });

  it('puts both sides on one scale for the bars', () => {
    const rows = ladderRows(ladderPrices(250, 7, 0.05), { bids, asks });
    const at = (p: number) => rows.find((r) => r.price === p)!;
    // The deepest row on screen is the bids' 400 at 249.90.
    expect(at(249.9).bidShare).toBe(1);
    expect(at(249.95).bidShare).toBe(0.25);
    expect(at(250.1).askShare).toBe(0.5);
    expect(at(250).bidShare ?? at(250).askShare).toBeUndefined();
  });

  it('formats the price text, and ignores levels with no usable price or size', () => {
    const rows = ladderRows([250], {
      bids: [
        [Number.NaN, 10],
        [250, -5],
      ],
      asks: [[250, 3]],
      format: (p) => `$${p.toFixed(2)}`,
    });
    expect(rows[0].text).toBe('$250.00');
    expect(rows[0].bid).toBeUndefined();
    expect(bestPrices([[Number.NaN, 10], [249, 5]], []).bid).toBe(249);
  });
});

describe('unusable ticks and prices', () => {
  it('a tick of zero or NaN gives no prices rather than throwing', () => {
    expect(ladderPrices(250, 5, 0)).toEqual([]);
    expect(ladderPrices(250, 5, Number.NaN)).toEqual([]);
    expect(midPrice([[249.95, 1]], [[250.05, 1]], 0)).toBeUndefined();
  });

  it('stops at the first price a tick function has no tick for', () => {
    const tick = (p: number) => (p < 252 ? 1 : 0);
    expect(ladderPrices(250, 7, tick)).toEqual([252, 251, 250, 249, 248, 247]);
  });

  it('leaves out prices at or below zero', () => {
    expect(ladderPrices(0.02, 7, 0.01)).toEqual([0.05, 0.04, 0.03, 0.02, 0.01]);
    expect(ladderPrices(0, 5, 0.01)).toEqual([]);
  });

  it('takes a whole number of rows', () => {
    expect(ladderPrices(250, 3.7, 0.05)).toEqual([250.05, 250, 249.95]);
  });
});
