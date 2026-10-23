// @vitest-environment jsdom
// The live records start afresh once a few thousand different rows have been
// drawn (live.svelte.ts renew), so a long session does not keep a signal per
// row it ever drew. Ticks and flashes still repaint after.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Grid from './Grid.svelte';
import type { ColumnDef, GridRow } from './column';
import type { GridApi } from './api';
import './test-fixtures/mount-grid'; // jsdom stubs (ResizeObserver)

const renewed = vi.hoisted(() => ({ calls: 0 }));
vi.mock('./live.svelte', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./live.svelte')>();
  return {
    ...mod,
    createLiveRows: () => {
      const live = mod.createLiveRows();
      const renew = live.renew;
      live.renew = (now) => {
        renewed.calls++;
        renew(now);
      };
      return live;
    },
  };
});

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'px', header: 'Px', decimals: 0 },
];
const batch = (b: number): GridRow[] => Array.from({ length: 120 }, (_, i) => ({ id: b * 1000 + i, sym: `S${b}-${i}`, px: i }));

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

describe('live records', () => {
  it('start afresh after many different rows are drawn, and ticks and flashes still repaint', () => {
    const target = document.createElement('div');
    document.body.append(target);
    let api: GridApi | undefined;
    const props: { columns: ColumnDef[]; rows: GridRow[]; height: number; onReady: (a: GridApi) => void } = $state({
      columns,
      rows: batch(0),
      height: 4000,
      onReady: (a: GridApi) => (api = a),
    });
    const grid = mount(Grid, { target, props });
    flushSync();
    stop = () => {
      unmount(grid);
      target.remove();
    };
    const cell = (sym: string, col: number) =>
      [...target.querySelectorAll('.spacer > .row')]
        .find((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim() === sym)
        ?.querySelector(`[aria-colindex="${col}"]`);

    api!.patchRows([[0, { px: 50 }]]);
    flushSync();
    expect(cell('S0-0', 2)?.textContent?.trim()).toBe('50');
    expect(renewed.calls).toBe(0);
    // Over 5,000 different rows drawn, about 115 at a time.
    for (let b = 1; b <= 50; b++) {
      props.rows = batch(b);
      flushSync();
    }
    expect(renewed.calls).toBe(1);

    api!.patchRows([[50_000, { px: 70 }]]);
    flushSync();
    expect(cell('S50-0', 2)?.textContent?.trim()).toBe('70');
    api!.flashCells({ rows: [50_001] });
    flushSync();
    expect(cell('S50-1', 2)?.querySelector('.flash')).not.toBeNull();
  });
});
