// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { GridRow } from './column';
import { createLiveRows } from './live.svelte';

const rows = (): GridRow[] => [
  { id: 1, px: 10, vol: 100 },
  { id: 2, px: 20, vol: 200 },
  { id: 3, px: 30, vol: 300 },
];
const idOf = (r: GridRow) => r.id;
const indexOf = (rs: GridRow[]) => new Map(rs.map((r) => [r.id, r] as const));

/** Counts how often an effect reading `read()` re-runs. */
function watch(read: () => unknown): { runs: () => number; stop: () => void } {
  let n = 0;
  const stop = $effect.root(() => {
    $effect(() => {
      read();
      n++;
    });
  });
  flushSync();
  return { runs: () => n, stop };
}

describe('createLiveRows: patch', () => {
  it('writes into the rows in place and reports how many rows changed', () => {
    const live = createLiveRows();
    const rs = rows();
    const n = live.patch(indexOf(rs), [[1, { px: 11 }], [2, { px: 20 }], [9, { px: 1 }]], rs, idOf);
    expect(n).toBe(1); // row 2's value is unchanged, row 9 does not exist
    expect(rs[0].px).toBe(11);
  });

  it('bumps the row, each changed field and the data version, for rendered rows only', () => {
    const live = createLiveRows();
    const rs = rows();
    live.patch(indexOf(rs), [[1, { px: 11, vol: 101 }], [3, { px: 31 }]], [rs[0]], idOf);
    expect(live.rowVersion(1)).toBe(1);
    expect(live.fieldVersion(1, 'px')).toBe(1);
    expect(live.fieldVersion(1, 'vol')).toBe(1);
    expect(live.rowVersion(3)).toBeUndefined(); // changed, but not rendered
    expect(rs[2].px).toBe(31);
    expect(live.dataVersion).toBe(1);
  });

  it('bumps a row rendered twice (pinned and in the body) once', () => {
    const live = createLiveRows();
    const rs = rows();
    live.patch(indexOf(rs), [[1, { px: 11 }]], [rs[0], rs[0]], idOf);
    expect(live.rowVersion(1)).toBe(1);
  });

  it('a patch that changes nothing bumps nothing', () => {
    const live = createLiveRows();
    const rs = rows();
    expect(live.patch(indexOf(rs), [[1, { px: 10 }]], rs, idOf)).toBe(0);
    expect(live.dataVersion).toBe(0);
  });

  it('wakes only the readers of what changed', () => {
    const live = createLiveRows();
    const rs = rows();
    const px1 = watch(() => live.fieldVersion(1, 'px'));
    const vol1 = watch(() => live.fieldVersion(1, 'vol'));
    const row2 = watch(() => live.rowVersion(2));
    live.patch(indexOf(rs), [[1, { px: 11 }]], rs, idOf);
    flushSync();
    expect(px1.runs()).toBe(2);
    expect(vol1.runs()).toBe(1);
    expect(row2.runs()).toBe(1);
    for (const w of [px1, vol1, row2]) w.stop();
  });
});

describe('createLiveRows: flash', () => {
  it('flashes the named rendered rows once each, counting repeats', () => {
    const live = createLiveRows();
    const rs = rows();
    expect(live.flash({ rows: [1, 3, 9], dir: 'up', ms: 500 }, [rs[0], rs[0], rs[1], rs[2]], idOf, 1000, undefined)).toBe(2);
    expect(live.cellFlash(1)).toEqual({ seq: 1, dir: 'up', at: 1000, ms: 500, columns: null, hold: undefined });
    expect(live.cellFlash(2)).toBeNull();
    live.flash({ rows: [1], columns: ['px'] }, rs, idOf, 2000, true);
    const again = live.cellFlash(1)!;
    expect(again.seq).toBe(2);
    expect(again.dir).toBe('same');
    expect([...(again.columns ?? [])]).toEqual(['px']);
    expect(again.hold).toBe(true);
  });

  it('decides whether it holds once, from how many rows flash', () => {
    const live = createLiveRows();
    const decide = vi.fn((n: number, _columns: number | null) => n > 1);
    expect(live.flash({ rows: [1, 2] }, rows(), idOf, 0, decide)).toBe(2);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledWith(2, null);
    expect(live.cellFlash(1)?.hold).toBe(true);
    expect(live.cellFlash(2)?.hold).toBe(true);
    live.flash({ rows: [1], columns: ['px', 'qty'] }, rows(), idOf, 0, decide);
    expect(decide).toHaveBeenLastCalledWith(1, 2);
    // Nothing on screen to flash: nothing is counted.
    expect(live.flash({ rows: [9] }, rows(), idOf, 0, decide)).toBe(0);
    expect(decide).toHaveBeenCalledTimes(2);
  });

  it('flashes every rendered row when no rows are named', () => {
    const live = createLiveRows();
    expect(live.flash({}, rows(), idOf, 0, undefined)).toBe(3);
  });
});
