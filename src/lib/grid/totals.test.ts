import { describe, expect, it } from 'vitest';
import { aggregate } from './aggregate';
import type { ColumnDef, GridRow } from './column';
import { cellValue } from './column';
import { scanTotals, type TotalTarget, type ViewTotals } from './totals';

const qty: ColumnDef = { type: 'number', key: 'qty', header: 'Qty' };
const notional: ColumnDef = { type: 'number', key: 'notional', header: 'N', value: (r) => (r.px as number) * (r.qty as number) };
const targets: TotalTarget[] = [
  { col: qty, kind: 'footer', extremes: true },
  { col: notional, kind: 'footer', extremes: true },
  { col: qty, kind: 'range', extremes: true },
];

function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

/** The reference, as the footer computed it: aggregate() over finite Number(value). */
function reference(col: ColumnDef, rows: GridRow[]) {
  const vals: number[] = [];
  for (const r of rows) {
    const n = Number(cellValue(col, r));
    if (Number.isFinite(n)) vals.push(n);
  }
  return aggregate(vals);
}

/** A patch, applied the way the grid does: remove, write, add. */
function patch(t: ViewTotals, row: GridRow, values: Record<string, unknown>) {
  const inView = t.remove(row);
  Object.assign(row, values);
  if (inView) t.add(row);
}

describe('scanTotals', () => {
  it('stays equal to a full aggregate through random patches (integers, so exactly)', () => {
    const rand = prng(3);
    const rows: GridRow[] = Array.from({ length: 500 }, (_, i) => ({ id: i, px: 1 + Math.floor(rand() * 100), qty: Math.floor(rand() * 1000) }));
    const t = scanTotals(rows, targets, false);
    for (let k = 0; k < 2000; k++) {
      const row = rows[Math.floor(rand() * rows.length)];
      patch(t, row, rand() < 0.5 ? { qty: Math.floor(rand() * 1000) } : { px: 1 + Math.floor(rand() * 100) });
      if (k % 97 === 0) {
        expect(t.get('footer', 'qty')).toEqual(reference(qty, rows));
        expect(t.get('footer', 'notional')).toEqual(reference(notional, rows));
      }
    }
    expect(t.updates).toBe(2000);
  });

  it('settles min and max when an extreme moves inward', () => {
    const rows: GridRow[] = [{ id: 1, qty: 5 }, { id: 2, qty: 9 }, { id: 3, qty: 1 }];
    const t = scanTotals(rows, targets, false);
    patch(t, rows[1], { qty: 2 }); // the max goes from 9 to 5
    patch(t, rows[2], { qty: 4 }); // the min goes from 1 to 2
    expect(t.get('footer', 'qty')).toMatchObject({ min: 2, max: 5, sum: 11, count: 3 });
  });

  it('many rows sharing the minimum: moving one keeps the minimum without a rescan', () => {
    const rows: GridRow[] = [{ id: 1, qty: 0 }, { id: 2, qty: 0 }, { id: 3, qty: 5 }];
    const t = scanTotals(rows, targets, false);
    patch(t, rows[0], { qty: 3 });
    expect(t.get('range', 'qty')).toMatchObject({ min: 0, max: 5 });
    patch(t, rows[1], { qty: 4 }); // the last 0 moves: min becomes 3
    expect(t.get('range', 'qty')).toMatchObject({ min: 3, max: 5 });
  });

  it('counts a blank as 0 in the footer and skips it in a range', () => {
    const rows: GridRow[] = [{ id: 1, qty: 4 }, { id: 2, qty: null }, { id: 3, qty: '' }];
    const t = scanTotals(rows, targets, false);
    expect(t.get('footer', 'qty')).toMatchObject({ count: 3, min: 0, sum: 4 });
    expect(t.get('range', 'qty')).toMatchObject({ count: 1, min: 4, max: 4 });
    patch(t, rows[0], { qty: undefined });
    expect(t.get('range', 'qty')).toBeNull();
  });

  it('with a filter, a row outside the view changes nothing', () => {
    const rows: GridRow[] = [{ id: 1, qty: 4 }, { id: 2, qty: 6 }];
    const t = scanTotals([rows[0]], targets, true);
    patch(t, rows[1], { qty: 100 });
    expect(t.get('footer', 'qty')).toMatchObject({ sum: 4, count: 1 });
  });

  it('a huge value that is later corrected does not wipe out the small ones', () => {
    const sumOnly: TotalTarget[] = [{ col: qty, kind: 'footer', extremes: false }];
    const rows: GridRow[] = [{ id: 1, qty: 10.5 }, { id: 2, qty: 20 }, { id: 3, qty: 40 }];
    const t = scanTotals(rows, sumOnly, false);
    patch(t, rows[0], { qty: 1e17 }); // a bad tick
    patch(t, rows[0], { qty: 10.5 }); // corrected
    expect(t.get('footer', 'qty')?.sum).toBe(70.5);
  });

  it('a sum-only footer keeps no min and max', () => {
    const sumOnly: TotalTarget[] = [{ col: qty, kind: 'footer', extremes: false }];
    const rows: GridRow[] = [{ id: 1, qty: 1 }, { id: 2, qty: 9 }];
    const t = scanTotals(rows, sumOnly, false);
    patch(t, rows[1], { qty: 2 });
    expect(t.get('footer', 'qty')).toMatchObject({ sum: 3, count: 2 });
  });

  it('with nothing to track, a row is never taken out', () => {
    expect(scanTotals([{ id: 1 }], [], false).remove({ id: 1 })).toBe(false);
  });
});
