// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('createLiveRows: renew', () => {
  it('starts the versions afresh, and every reader reads once more', () => {
    const live = createLiveRows();
    const rs = rows();
    live.patch(indexOf(rs), [[1, { px: 11 }]], rs, idOf);
    const px1 = watch(() => live.fieldVersion(1, 'px'));
    const row1 = watch(() => live.rowVersion(1));
    live.renew(0);
    flushSync();
    expect(live.rowVersion(1)).toBeUndefined();
    expect(live.fieldVersion(1, 'px')).toBeUndefined();
    expect(px1.runs()).toBe(2);
    expect(row1.runs()).toBe(2);
    // The readers now follow the fresh records.
    live.patch(indexOf(rs), [[1, { px: 12 }]], rs, idOf);
    flushSync();
    expect(live.fieldVersion(1, 'px')).toBe(1);
    expect(px1.runs()).toBe(3);
    expect(row1.runs()).toBe(3);
    px1.stop();
    row1.stop();
  });

  it('keeps a flash that is still playing and drops the old ones', () => {
    const live = createLiveRows();
    const rs = rows();
    live.flash({ rows: [1] }, rs, idOf, 1_000, undefined);
    live.flash({ rows: [2], ms: 30_000 }, rs, idOf, 1_000, undefined);
    live.flash({ rows: [3] }, rs, idOf, 20_000, undefined);
    live.renew(20_500);
    expect(live.cellFlash(1)).toBeNull();
    expect(live.cellFlash(2)?.seq).toBe(1);
    expect(live.cellFlash(3)?.seq).toBe(1);
    // A dropped request starts over; a kept one counts on.
    live.flash({}, rs, idOf, 21_000, undefined);
    expect(live.cellFlash(1)?.seq).toBe(1);
    expect(live.cellFlash(3)?.seq).toBe(2);
  });
});

describe('createLiveRows: update rates', () => {
  afterEach(() => vi.useRealTimers());
  const rates = new Map([['vol', 250]]);

  it('shows the first change after a quiet spell at once, then at most one repaint per beat', () => {
    vi.useFakeTimers({ now: 1000 });
    const live = createLiveRows();
    const rs = rows();
    const vol1 = watch(() => live.fieldVersion(1, 'vol'));
    live.patch(indexOf(rs), [[1, { vol: 101 }]], rs, idOf, undefined, rates);
    flushSync();
    expect(live.fieldVersion(1, 'vol')).toBe(1);
    vi.advanceTimersByTime(100);
    live.patch(indexOf(rs), [[1, { vol: 102 }]], rs, idOf, undefined, rates);
    vi.advanceTimersByTime(50);
    live.patch(indexOf(rs), [[1, { vol: 103 }]], rs, idOf, undefined, rates);
    flushSync();
    // Written at once, shown on the beat (250 ms after the last repaint).
    expect(rs[0].vol).toBe(103);
    expect(live.fieldVersion(1, 'vol')).toBe(1);
    vi.advanceTimersByTime(99);
    expect(live.fieldVersion(1, 'vol')).toBe(1);
    vi.advanceTimersByTime(1);
    flushSync();
    expect(live.fieldVersion(1, 'vol')).toBe(2);
    expect(vol1.runs()).toBe(3);
    vol1.stop();
  });

  it('a row waits for its row version only when every field that changed waits', () => {
    vi.useFakeTimers({ now: 1000 });
    const live = createLiveRows();
    const rs = rows();
    live.patch(indexOf(rs), [[1, { vol: 101 }]], rs, idOf, undefined, rates);
    expect(live.rowVersion(1)).toBe(1);
    vi.setSystemTime(1100);
    live.patch(indexOf(rs), [[1, { vol: 102 }]], rs, idOf, undefined, rates);
    expect(live.rowVersion(1)).toBe(1);
    live.patch(indexOf(rs), [[1, { px: 11 }]], rs, idOf, undefined, rates);
    expect(live.fieldVersion(1, 'px')).toBe(1);
    expect(live.rowVersion(1)).toBe(2);
    expect(live.fieldVersion(1, 'vol')).toBe(1);
    vi.advanceTimersByTime(150);
    expect(live.fieldVersion(1, 'vol')).toBe(2);
  });

  it('shows every change of the call that ends a quiet spell', () => {
    vi.useFakeTimers({ now: 1000 });
    const live = createLiveRows();
    const rs = rows();
    live.patch(indexOf(rs), [[1, { vol: 101 }], [2, { vol: 201 }], [3, { vol: 301 }]], rs, idOf, undefined, rates);
    expect([1, 2, 3].map((id) => live.fieldVersion(id, 'vol'))).toEqual([1, 1, 1]);
  });

  it('stop() drops what waits', () => {
    vi.useFakeTimers({ now: 1000 });
    const live = createLiveRows();
    const rs = rows();
    live.patch(indexOf(rs), [[1, { vol: 101 }]], rs, idOf, undefined, rates);
    vi.setSystemTime(1100);
    live.patch(indexOf(rs), [[1, { vol: 102 }]], rs, idOf, undefined, rates);
    live.stop();
    vi.advanceTimersByTime(1000);
    expect(live.fieldVersion(1, 'vol')).toBe(1);
  });
});
