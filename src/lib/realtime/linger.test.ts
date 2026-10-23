import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLinger } from './linger';

interface Order {
  id: number;
  status: string;
}
const o = (id: number, status = 'Working'): Order => ({ id, status });

afterEach(() => vi.useRealTimers());

describe('createLinger', () => {
  it('keeps a row that left, where it stood, until its time is up', () => {
    vi.useFakeTimers({ now: 1000 });
    const onExpire = vi.fn();
    const linger = createLinger<Order, number>({ ms: 500, key: (r) => r.id, onExpire });
    const [a, b, c] = [o(1), o(2), o(3)];
    expect(linger.update([a, b, c]).map((r) => r.id)).toEqual([1, 2, 3]);
    // b leaves: it stays in its place, marked.
    const shown = linger.update([a, c]);
    expect(shown.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(linger.leaving(b)).toBe(true);
    expect(linger.leaving(a)).toBe(false);
    expect(linger.size).toBe(1);
    // A new row while b is on its way out: b keeps its place among its neighbours.
    const z = o(0);
    expect(linger.update([z, a, c]).map((r) => r.id)).toEqual([0, 1, 2, 3]);
    vi.advanceTimersByTime(499);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(linger.update([z, a, c]).map((r) => r.id)).toEqual([0, 1, 3]);
    expect(linger.size).toBe(0);
  });

  it('a row that comes back before its time is simply there again', () => {
    vi.useFakeTimers({ now: 1000 });
    const linger = createLinger<Order, number>({ ms: 500, key: (r) => r.id });
    const a = o(1);
    linger.update([a, o(2)]);
    linger.update([o(2)]);
    expect(linger.size).toBe(1);
    const again = o(1, 'Partial');
    const shown = linger.update([again, o(2)]);
    expect(shown.map((r) => r.status)).toEqual(['Partial', 'Working']);
    expect(linger.leaving(again)).toBe(false);
    expect(linger.size).toBe(0);
  });

  it('several rows leaving keep their order; each goes on its own time', () => {
    vi.useFakeTimers({ now: 1000 });
    const onExpire = vi.fn();
    const linger = createLinger<Order, number>({ ms: 500, key: (r) => r.id, onExpire });
    const rows = [o(1), o(2), o(3), o(4)];
    linger.update(rows);
    linger.update([rows[0], rows[2], rows[3]]);
    vi.advanceTimersByTime(200);
    expect(linger.update([rows[2]]).map((r) => r.id)).toEqual([1, 2, 3, 4]);
    vi.advanceTimersByTime(300);
    expect(onExpire).toHaveBeenCalledTimes(1);
    // 2 is due; 1 and 4 left later and stay.
    expect(linger.update([rows[2]]).map((r) => r.id)).toEqual([1, 3, 4]);
    vi.advanceTimersByTime(200);
    expect(onExpire).toHaveBeenCalledTimes(2);
    expect(linger.update([rows[2]]).map((r) => r.id)).toEqual([3]);
  });

  it('rows leaving together keep their order, after the row that stays before them, however the list is reordered', () => {
    vi.useFakeTimers({ now: 1000 });
    const linger = createLinger<Order, number>({ ms: 500, key: (r) => r.id });
    const [r1, r2, r3, r4, r5] = [o(1), o(2), o(3), o(4), o(5)];
    linger.update([r1, r2, r3, r4, r5]);
    // 2 and 3 leave together after 1; 5 leaves at the end.
    expect(linger.update([r1, r4]).map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    // The list is reordered (a sort flipped): each follows its row again.
    expect(linger.update([r4, r1]).map((r) => r.id)).toEqual([4, 5, 1, 2, 3]);
  });

  it('rows leaving before any row that stays go first', () => {
    vi.useFakeTimers({ now: 1000 });
    const linger = createLinger<Order, number>({ ms: 500, key: (r) => r.id });
    const [r1, r2, r3] = [o(1), o(2), o(3)];
    linger.update([r1, r2, r3]);
    expect(linger.update([r3]).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(linger.update([o(9), r3]).map((r) => r.id)).toEqual([1, 2, 9, 3]);
  });

  it('a time that is not a number of ms is refused', () => {
    expect(() => createLinger<Order, number>({ ms: Number.NaN, key: (r) => r.id })).toThrow(RangeError);
    expect(() => createLinger<Order, number>({ ms: -1, key: (r) => r.id })).toThrow(RangeError);
  });

  it('stop() drops the rows on their way out and the pending call', () => {
    vi.useFakeTimers({ now: 1000 });
    const onExpire = vi.fn();
    const linger = createLinger<Order, number>({ ms: 500, key: (r) => r.id, onExpire });
    linger.update([o(1)]);
    linger.update([]);
    linger.stop();
    vi.advanceTimersByTime(1000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(linger.size).toBe(0);
    expect(linger.update([])).toEqual([]);
  });
});
