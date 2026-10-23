import { describe, expect, it } from 'vitest';
import { diffRows } from './rowdiff';

type Row = { id: number };
const make = (n: number): Row[] => Array.from({ length: n }, (_, id) => ({ id }));
const diff = (prev: Row[], next: Row[], limit = 1000) => {
  const was = new Set(prev);
  return diffRows(prev, next, (r) => was.has(r), limit);
};

function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('diffRows', () => {
  it('finds rows appended, prepended and inserted', () => {
    const p = make(5);
    const a = { id: 10 };
    const b = { id: 11 };
    const c = { id: 12 };
    expect(diff(p, [...p, a])).toEqual({ added: [a], removed: [] });
    expect(diff(p, [b, ...p])).toEqual({ added: [b], removed: [] });
    expect(diff(p, [...p.slice(0, 2), c, ...p.slice(2)])).toEqual({ added: [c], removed: [] });
  });

  it('finds rows removed anywhere, and a row replaced by a copy', () => {
    const p = make(6);
    expect(diff(p, [p[1], p[2], p[4]])).toEqual({ added: [], removed: [p[0], p[3], p[5]] });
    const copy = { ...p[2] };
    expect(diff(p, [p[0], p[1], copy, p[3], p[4], p[5]])).toEqual({ added: [copy], removed: [p[2]] });
  });

  it('returns null when rows were reordered', () => {
    const p = make(4);
    expect(diff(p, [p[1], p[0], p[2], p[3]])).toBeNull();
    expect(diff(p, [p[0], p[2], p[1], p[3]])).toBeNull();
    expect(diff(p, [p[3], p[0], p[1], p[2]])).toBeNull();
    expect(diff(p, [p[1], p[2], p[3], p[0]])).toBeNull();
  });

  it('returns null past the limit', () => {
    const p = make(10);
    expect(diff(p, p.slice(5), 4)).toBeNull();
    expect(diff(p, p.slice(5), 5)).not.toBeNull();
  });

  it('is exact on random adds and removes, and never accepts a reorder', () => {
    const rand = prng(11);
    for (let round = 0; round < 300; round++) {
      const prev = make(30 + Math.floor(rand() * 30));
      let next = prev.filter(() => rand() > 0.15);
      const added: Row[] = [];
      for (let k = Math.floor(rand() * 5); k > 0; k--) {
        const row = { id: 1000 + round * 10 + k };
        next.splice(Math.floor(rand() * (next.length + 1)), 0, row);
        added.push(row);
      }
      const shuffled = rand() < 0.3 && next.length > 2;
      if (shuffled) {
        const a = Math.floor(rand() * next.length);
        const b = (a + 1 + Math.floor(rand() * (next.length - 1))) % next.length;
        // Swap two rows that were both in prev, so the kept order changes.
        if (prev.includes(next[a]) && prev.includes(next[b])) [next[a], next[b]] = [next[b], next[a]];
        else next = [...next];
      }
      const d = diff(prev, next);
      const keptInOrder = (() => {
        const kept = next.filter((r) => prev.includes(r));
        return kept.every((r, i) => i === 0 || prev.indexOf(kept[i - 1]) < prev.indexOf(r));
      })();
      if (!keptInOrder) {
        expect(d).toBeNull();
        continue;
      }
      expect(d).not.toBeNull();
      expect(new Set(d!.added)).toEqual(new Set(next.filter((r) => !prev.includes(r))));
      expect(new Set(d!.removed)).toEqual(new Set(prev.filter((r) => !next.includes(r))));
    }
  });
});
