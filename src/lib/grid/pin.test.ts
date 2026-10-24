import { describe, it, expect } from 'vitest';
import type { ColumnDef } from './column';
import { arrangePinned, fitWidths } from './pin';

const cols: ColumnDef[] = [
  { type: 'text', key: 'name', header: 'Name', width: 120 },
  { type: 'price', key: 'price', header: 'Price', width: 80, pinned: true },
  { type: 'volume', key: 'vol', header: 'Vol', width: 90 },
  { type: 'text', key: 'sym', header: 'Sym', width: 100, pinned: true },
];

describe('arrangePinned', () => {
  it('leaves order untouched when nothing is pinned', () => {
    const plain: ColumnDef[] = [{ type: 'text', key: 'a', header: 'A', width: 50 }];
    const r = arrangePinned(plain);
    expect(r.anyPinned).toBe(false);
    expect(r.columns).toEqual(plain);
    expect(r.totalWidth).toBe(50);
  });

  it('moves pinned columns to the front in original relative order', () => {
    const r = arrangePinned(cols);
    expect(r.columns.map((c) => c.key)).toEqual(['price', 'sym', 'name', 'vol']);
    expect(r.anyPinned).toBe(true);
  });

  it('computes cumulative sticky offsets for pinned columns only', () => {
    const r = arrangePinned(cols);
    // price (pinned, left 0, w80), sym (pinned, left 80, w100), name (not), vol (not)
    expect(r.info[0]).toMatchObject({ pinned: true, left: 0, width: 80 });
    expect(r.info[1]).toMatchObject({ pinned: true, left: 80, width: 100 });
    expect(r.info[2].pinned).toBe(false);
    expect(r.info[3].pinned).toBe(false);
    expect(r.totalWidth).toBe(120 + 80 + 90 + 100);
  });

  it('pins to the right edge with cumulative right offsets', () => {
    const c: ColumnDef[] = [
      { type: 'text', key: 'a', header: 'A', width: 100 },
      { type: 'number', key: 'b', header: 'B', width: 60, pinned: 'right' },
      { type: 'number', key: 'c', header: 'C', width: 80, pinned: 'right' },
    ];
    const r = arrangePinned(c);
    // unpinned first, then right-pinned in original order
    expect(r.columns.map((x) => x.key)).toEqual(['a', 'b', 'c']);
    expect(r.info[0]).toMatchObject({ pinned: false, side: null });
    // b sits left of c: its right offset clears c's width (80); c is flush (0)
    expect(r.info[1]).toMatchObject({ pinned: true, side: 'right', right: 80 });
    expect(r.info[2]).toMatchObject({ pinned: true, side: 'right', right: 0 });
  });

  it('supports left and right pins together', () => {
    const c: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym', width: 100, pinned: 'left' },
      { type: 'number', key: 'mid', header: 'Mid', width: 90 },
      { type: 'number', key: 'act', header: 'Act', width: 70, pinned: 'right' },
    ];
    const r = arrangePinned(c);
    expect(r.columns.map((x) => x.key)).toEqual(['sym', 'mid', 'act']);
    expect(r.info[0]).toMatchObject({ side: 'left', left: 0 });
    expect(r.info[2]).toMatchObject({ side: 'right', right: 0 });
  });
});

describe('arrangePinned — fill', () => {
  const flexCols: ColumnDef[] = [
    { type: 'text', key: 'a', header: 'A', width: 100, pinned: true },
    { type: 'text', key: 'b', header: 'B', flex: 1, width: 100 },
    { type: 'text', key: 'c', header: 'C', flex: 3, width: 100 },
  ];

  it('shares the room by weight, from zero, as CSS flex does (flex wins over width)', () => {
    const r = arrangePinned(flexCols, 700);
    expect(r.info.map((i) => i.width)).toEqual([100, 150, 450]);
    expect(r.totalWidth).toBe(700);
  });

  it('shares what is left after each cell padding, as CSS flex does', () => {
    // 16px of padding per cell: CSS gives b 16 + 568/4 = 158, c 16 + 3 * 568/4 = 442.
    const r = arrangePinned(flexCols, 700, undefined, 16);
    expect(r.info.map((i) => i.width)).toEqual([100, 158, 442]);
  });

  it('keeps the total exactly equal to the available width (no stray overflow)', () => {
    const r = arrangePinned(flexCols, 701);
    expect(r.totalWidth).toBe(701);
    expect(r.info.every((i) => Number.isInteger(i.width))).toBe(true);
  });

  it('never shrinks below the base widths', () => {
    const r = arrangePinned(flexCols, 200);
    expect(r.info.map((i) => i.width)).toEqual([100, 100, 100]);
  });

  it('leaves fixed-width columns alone when nothing flexes', () => {
    const r = arrangePinned(cols, 2000);
    expect(r.totalWidth).toBe(390);
  });

  it('respects a flex column maxWidth and hands the rest to the others', () => {
    const capped: ColumnDef[] = [
      { type: 'text', key: 'a', header: 'A', flex: 1, width: 100, maxWidth: 150 },
      { type: 'text', key: 'b', header: 'B', flex: 1, width: 100 },
    ];
    const r = arrangePinned(capped, 600);
    expect(r.info.map((i) => i.width)).toEqual([150, 450]);
  });

  it('starts a flex column without a width at its minWidth, then fills — not at a 160 px default', () => {
    // A narrow watchlist: 58 + flex + 60 + 54 in a 286 px pane.
    const watch: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Symbol', width: 58, pinned: true },
      { type: 'price', key: 'last', header: 'Last', flex: 1, minWidth: 84 },
      { type: 'percent', key: 'chg', header: '24h', width: 60 },
      { type: 'volume', key: 'vol', header: 'Vol', width: 54 },
    ];
    const r = arrangePinned(watch, 286);
    expect(r.info.map((i) => i.width)).toEqual([58, 114, 60, 54]);
    expect(r.totalWidth).toBe(286);
  });

  it('stops a flex column at its minWidth (64 without one) when the pane is too narrow', () => {
    const narrow: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Symbol', width: 58, pinned: true },
      { type: 'price', key: 'last', header: 'Last', flex: 1, minWidth: 84 },
      { type: 'text', key: 'note', header: 'Note', flex: 1 },
    ];
    const r = arrangePinned(narrow, 120);
    expect(r.info.map((i) => i.width)).toEqual([58, 84, 64]);
  });

  it('recomputes right-pinned offsets from the filled widths', () => {
    const withRight: ColumnDef[] = [
      { type: 'text', key: 'a', header: 'A', flex: 1, width: 100 },
      { type: 'text', key: 'r1', header: 'R1', width: 50, pinned: 'right' },
      { type: 'text', key: 'r2', header: 'R2', width: 60, pinned: 'right' },
    ];
    const r = arrangePinned(withRight, 410);
    expect(r.info[0].width).toBe(300);
    expect(r.info[2].right).toBe(0);
    expect(r.info[1].right).toBe(60);
    // Its cells take any room left, so the right-pinned columns dock right.
    expect(r.firstRight).toBe(1);
    expect(arrangePinned(flexCols, 700).firstRight).toBe(-1);
  });
});

describe('fitWidths (fitColumns)', () => {
  const plain = (n: number, extra: Partial<ColumnDef>[] = []): ColumnDef[] =>
    Array.from({ length: n }, (_, i) => ({ type: 'number', key: `c${i}`, header: `C${i}`, ...(extra[i] ?? {}) }) as ColumnDef);

  it('grows every column in proportion to its base width', () => {
    expect(fitWidths(plain(3), [100, 50, 50], [64, 50, 50], 400)).toEqual([200, 100, 100]);
  });

  it('shrinks every column in proportion while they stay above their floors', () => {
    expect(fitWidths(plain(3), [200, 100, 100], [64, 64, 64], 300)).toEqual([150, 75, 75]);
  });

  it('holds a column at its floor and shares the rest in proportion', () => {
    expect(fitWidths(plain(3), [200, 100, 100], [64, 90, 64], 240)).toEqual([86, 90, 64]);
  });

  it('caps a column at its maxWidth and hands the rest to the others', () => {
    expect(fitWidths(plain(2, [{ maxWidth: 120 }]), [100, 100], [50, 50], 400)).toEqual([120, 280]);
  });

  it('falls back to the floors when even they do not fit (the grid scrolls)', () => {
    expect(fitWidths(plain(2), [200, 200], [80, 80], 100)).toEqual([80, 80]);
  });

  it('lands exactly on the available width in whole pixels', () => {
    const out = fitWidths(plain(3), [100, 100, 100], [10, 10, 10], 401);
    expect(out.reduce((a, b) => a + b, 0)).toBe(401);
    expect(out.every(Number.isInteger)).toBe(true);
  });

  it('is what arrangePinned uses when given a floor, pinned columns included', () => {
    const c: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym', width: 60, pinned: true },
      { type: 'number', key: 'px', header: 'Px', width: 120 },
      { type: 'number', key: 'vol', header: 'Vol', width: 60 },
    ];
    const r = arrangePinned(c, 480, (col) => col.minWidth ?? 40);
    expect(r.info.map((i) => i.width)).toEqual([120, 240, 120]);
    expect(r.totalWidth).toBe(480);
  });
});
