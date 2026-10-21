// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'px', header: 'Px', flash: 'auto' },
];

let grid: MountedGrid | null = null;
afterEach(() => {
  grid?.destroy();
  grid = null;
});

const pxText = (i: number) => grid!.target.querySelectorAll('.viewport .row [aria-colindex="2"] .bo-cell-text')[i];

/** Move every row's price by one tick, `times` times. */
function tick(times: number) {
  for (let n = 0; n < times; n++) {
    grid!.api().patchRows(grid!.rows.map((r) => [r.id as number, { px: (r.px as number) + n + 1 }] as const));
    flushSync();
  }
}

describe("flashMotion: 'auto'", () => {
  it('fades a flash on a quiet grid', () => {
    grid = mountGrid({ columns, flashMotion: 'auto' });
    tick(1);
    expect(pxText(0).classList.contains('flash')).toBe(true);
    expect(pxText(0).classList.contains('held')).toBe(false);
  });

  it('holds flashes once many overlap', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, sym: `S${i}`, px: 10 }));
    grid = mountGrid({ rows, columns, flashMotion: 'auto' });
    // 4 cells × 40 ticks, all inside one flash window: well past the hold level.
    tick(40);
    expect(pxText(0).classList.contains('flash')).toBe(true);
    expect(pxText(0).classList.contains('held')).toBe(true);
  });

  it("'fade' never holds, however busy", () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, sym: `S${i}`, px: 10 }));
    grid = mountGrid({ rows, columns, flashMotion: 'fade' });
    tick(40);
    expect(pxText(0).classList.contains('held')).toBe(false);
  });
});

describe('dataBar', () => {
  it('draws each bar full width and scales it to the value', () => {
    const rows = [
      { id: 1, sym: 'AAA', px: 10 },
      { id: 2, sym: 'BBB', px: 20 },
      { id: 3, sym: 'CCC', px: -5 },
    ];
    grid = mountGrid({ rows, columns: [columns[0], { type: 'number', key: 'px', header: 'Px', dataBar: { min: -20, max: 20 } }] });
    const bars = [...grid.target.querySelectorAll<HTMLElement>('.viewport .bo-databar')];
    expect(bars.map((b) => b.style.transform.replace(/\s+/g, ''))).toEqual([
      'translate(50%,-50%)scaleX(0.25)',
      'translate(50%,-50%)scaleX(0.5)',
      'translate(37.5%,-50%)scaleX(0.125)',
    ]);
    expect(bars.every((b) => b.style.width === '' && b.style.left === '')).toBe(true);
  });
});
