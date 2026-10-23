import { describe, expect, it } from 'vitest';
import type { ColumnDef, GridRow, SortState } from './column';
import { sortRows } from './column';
import { mergeChanged, rowOrder } from './livesort';

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'chg', header: 'Chg' },
  { type: 'number', key: 'vol', header: 'Vol' },
  { type: 'number', key: 'score', header: 'Score', value: (r) => (r.chg as number) * 10 + (r.vol as number) },
];

// Deterministic PRNG so failures reproduce.
function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

/** The reference: filter and sort from scratch. */
function fromScratch(rows: GridRow[], sorts: SortState[], passes: ((r: GridRow) => boolean) | null) {
  return sortRows(passes ? rows.filter(passes) : rows, sorts, columns);
}

describe('mergeChanged', () => {
  it('matches a full filter and sort after random ticks', () => {
    const rand = prng(7);
    const cases: Array<{ sorts: SortState[]; passes: ((r: GridRow) => boolean) | null }> = [
      { sorts: [{ key: 'chg', dir: 'desc' }], passes: null },
      { sorts: [{ key: 'chg', dir: 'asc' }, { key: 'vol', dir: 'desc' }], passes: null },
      { sorts: [{ key: 'score', dir: 'desc' }], passes: (r) => (r.vol as number) > 300 },
      { sorts: [], passes: (r) => (r.chg as number) >= 0 },
    ];
    for (const { sorts, passes } of cases) {
      const rows: GridRow[] = Array.from({ length: 300 }, (_, i) => ({
        id: i,
        sym: `S${i}`,
        chg: Math.round((rand() - 0.5) * 20), // many ties, to test the tie-break
        vol: Math.floor(rand() * 1000),
      }));
      const pos = new Map(rows.map((r, i) => [r, i] as const));
      const order = rowOrder(sorts, columns, (r) => pos.get(r) as number);
      let view = fromScratch(rows, sorts, passes);
      for (let round = 0; round < 40; round++) {
        const changed = new Set<GridRow>();
        const k = 1 + Math.floor(rand() * 30);
        for (let t = 0; t < k; t++) {
          const row = rows[Math.floor(rand() * rows.length)];
          row.chg = Math.round((rand() - 0.5) * 20);
          row.vol = Math.floor(rand() * 1000);
          changed.add(row);
        }
        view = mergeChanged(view, changed, passes, order);
        expect(view).toEqual(fromScratch(rows, sorts, passes));
      }
    }
  });

  it('drops a changed row that no longer passes and adds one that now does', () => {
    const a = { id: 1, v: 1 };
    const b = { id: 2, v: 2 };
    const c = { id: 3, v: -1 };
    const passes = (r: { v: number }) => r.v > 0;
    const order = (x: { v: number }, y: { v: number }) => x.v - y.v;
    b.v = -5;
    c.v = 3;
    expect(mergeChanged([a, b], new Set([b, c]), passes, order)).toEqual([a, c]);
  });

  it('with nothing that passes, returns the rows that did not change', () => {
    const rows = [{ v: 1 }, { v: 2 }];
    expect(mergeChanged(rows, new Set([rows[0]]), () => false, (x, y) => x.v - y.v)).toEqual([rows[1]]);
  });
});
