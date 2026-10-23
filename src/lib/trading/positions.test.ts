import { describe, expect, it } from 'vitest';
import { createPositions, unrealizedPnl } from './positions';

describe('createPositions (average cost)', () => {
  it('averages the price of fills that open or add to a position', () => {
    const book = createPositions();
    book.fill({ symbol: 'FPT', side: 'buy', qty: 100, price: 10 });
    const p = book.fill({ symbol: 'FPT', side: 'buy', qty: 300, price: 12 });
    expect(p).toMatchObject({ qty: 400, avgPrice: 11.5, realized: 0, bought: 400, sold: 0 });
  });

  it('realizes P&L on the closed part and keeps the average of the rest', () => {
    const book = createPositions();
    book.fill({ symbol: 'FPT', side: 'buy', qty: 400, price: 11.5 });
    const p = book.fill({ symbol: 'FPT', side: 'sell', qty: 100, price: 13 });
    expect(p).toMatchObject({ qty: 300, avgPrice: 11.5, realized: 150 });
    const flat = book.fill({ symbol: 'FPT', side: 'sell', qty: 300, price: 11 });
    expect(flat).toMatchObject({ qty: 0, avgPrice: 0, realized: 0 });
  });

  it('a fill through flat closes the position and opens the rest at its price', () => {
    const book = createPositions();
    book.fill({ symbol: 'HPG', side: 'buy', qty: 100, price: 20 });
    const p = book.fill({ symbol: 'HPG', side: 'sell', qty: 250, price: 22 });
    expect(p).toMatchObject({ qty: -150, avgPrice: 22, realized: 200 });
    // A short realizes when the price falls.
    const q = book.fill({ symbol: 'HPG', side: 'buy', qty: 50, price: 21 });
    expect(q).toMatchObject({ qty: -100, avgPrice: 22, realized: 250 });
  });

  it('takes fees off realized P&L', () => {
    const book = createPositions();
    book.fill({ symbol: 'VNM', side: 'buy', qty: 10, price: 70, fee: 1.5 });
    expect(book.get('VNM')?.realized).toBe(-1.5);
  });

  it('keeps each symbol apart, in the order they first traded, and hands out copies', () => {
    const book = createPositions();
    book.fill({ symbol: 'VCB', side: 'sell', qty: 5, price: 90 });
    book.fill({ symbol: 'FPT', side: 'buy', qty: 5, price: 100 });
    expect(book.all().map((p) => [p.symbol, p.qty])).toEqual([
      ['VCB', -5],
      ['FPT', 5],
    ]);
    const p = book.get('FPT')!;
    p.qty = 999;
    expect(book.get('FPT')?.qty).toBe(5);
    book.clear();
    expect(book.all()).toEqual([]);
    expect(book.get('FPT')).toBeUndefined();
  });

  it('rejects a fill that is not one, and books nothing of it', () => {
    const book = createPositions();
    expect(() => book.fill({ symbol: 'X', side: 'buy', qty: 0, price: 1 })).toThrow(RangeError);
    expect(() => book.fill({ symbol: 'X', side: 'buy', qty: -5, price: 1 })).toThrow(RangeError);
    expect(() => book.fill({ symbol: 'X', side: 'buy', qty: 5, price: Number.NaN })).toThrow(RangeError);
    expect(() => book.fill({ symbol: 'X', side: 'buy', qty: 5, price: 1, fee: Number.NaN })).toThrow(RangeError);
    expect(() => book.fill({ symbol: 'X', side: 'Buy' as 'buy', qty: 5, price: 1 })).toThrow(TypeError);
    expect(() => book.fill({ symbol: '', side: 'buy', qty: 5, price: 1 })).toThrow(TypeError);
    expect(book.get('X')).toBeUndefined();
  });

  it('a rebate (a negative fee) adds to realized P&L', () => {
    const book = createPositions();
    expect(book.fill({ symbol: 'X', side: 'buy', qty: 1, price: 1, fee: -0.25 }).realized).toBe(0.25);
  });

  it('fractional sizes that add up to flat are flat, with no dust left open', () => {
    const book = createPositions();
    book.fill({ symbol: 'BTC', side: 'buy', qty: 0.1, price: 10 });
    book.fill({ symbol: 'BTC', side: 'buy', qty: 0.2, price: 10 });
    const p = book.fill({ symbol: 'BTC', side: 'sell', qty: 0.3, price: 11 });
    expect(p.qty).toBe(0);
    expect(p.avgPrice).toBe(0);
    expect(p.realized).toBeCloseTo(0.3, 12);
    expect(unrealizedPnl(p, 50)).toBe(0);
    // The next fill opens afresh at its own price, not averaged with dust.
    expect(book.fill({ symbol: 'BTC', side: 'sell', qty: 0.1, price: 12 })).toMatchObject({ qty: -0.1, avgPrice: 12 });
  });
});

describe('unrealizedPnl', () => {
  it('marks a long and a short at a price', () => {
    expect(unrealizedPnl({ qty: 300, avgPrice: 11.5 }, 12)).toBe(150);
    expect(unrealizedPnl({ qty: -100, avgPrice: 22 }, 21)).toBe(100);
    expect(unrealizedPnl({ qty: 0, avgPrice: 0 }, 50)).toBe(0);
  });
});
