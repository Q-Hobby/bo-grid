import { describe, it, expect } from 'vitest';
import { parseClipboard, isSingleCell, copyText, pastePlan, fillPlan, fillExtent } from './clipboard';

describe('parseClipboard', () => {
  it('parses a rectangular TSV block', () => {
    const grid = parseClipboard('a\tb\tc\n1\t2\t3');
    expect(grid).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('returns a single cell for a bare value', () => {
    const grid = parseClipboard('42');
    expect(grid).toEqual([['42']]);
    expect(isSingleCell(grid)).toBe(true);
  });

  it('treats empty input as no cells', () => {
    expect(parseClipboard('')).toEqual([]);
  });

  it('strips a single trailing newline (spreadsheet export)', () => {
    const grid = parseClipboard('a\tb\n1\t2\n');
    expect(grid).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('normalises CRLF and lone CR line endings', () => {
    expect(parseClipboard('a\r\nb')).toEqual([['a'], ['b']]);
    expect(parseClipboard('a\rb')).toEqual([['a'], ['b']]);
  });

  it('preserves empty trailing cells within a row', () => {
    expect(parseClipboard('a\t\tc')).toEqual([['a', '', 'c']]);
  });

  it('keeps a blank interior line as an empty-string row', () => {
    expect(parseClipboard('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });

  it('isSingleCell is false for multi-row or multi-col grids', () => {
    expect(isSingleCell([['a'], ['b']])).toBe(false);
    expect(isSingleCell([['a', 'b']])).toBe(false);
    expect(isSingleCell([])).toBe(false);
  });
});

describe('copyText', () => {
  const text = (r: number, c: number) => `${r}${c}`;
  it('joins cells with tabs and rows with newlines, clipped to the grid', () => {
    expect(copyText({ r0: 0, c0: 0, r1: 5, c1: 5 }, 2, 2, () => true, text)).toBe('00\t01\n10\t11');
  });
  it('skips rows without data', () => {
    expect(copyText({ r0: 0, c0: 1, r1: 2, c1: 1 }, 3, 2, (r) => r !== 1, text)).toBe('01\n21');
  });
});

describe('pastePlan', () => {
  it('pastes a block from the top-left cell, clipped to the grid', () => {
    const plan = pastePlan(
      [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      ],
      { r0: 1, c0: 1, r1: 1, c1: 1 },
      2,
      3,
    );
    expect(plan.writes).toEqual([
      { r: 1, c: 1, raw: 'a' },
      { r: 1, c: 2, raw: 'b' },
    ]);
    expect(plan.extent).toEqual({ r0: 1, c0: 1, r1: 1, c1: 2 });
  });
  it('fills the whole selection with a single value', () => {
    const plan = pastePlan([['7']], { r0: 0, c0: 0, r1: 1, c1: 1 }, 5, 5);
    expect(plan.writes.map((w) => [w.r, w.c, w.raw])).toEqual([
      [0, 0, '7'],
      [0, 1, '7'],
      [1, 0, '7'],
      [1, 1, '7'],
    ]);
    expect(plan.extent).toEqual({ r0: 0, c0: 0, r1: 1, c1: 1 });
  });
  it('a ragged block pastes each row as long as it is and selects the widest', () => {
    const plan = pastePlan([['a'], ['b', 'c']], { r0: 0, c0: 0, r1: 0, c1: 0 }, 5, 5);
    expect(plan.writes.map((w) => w.raw)).toEqual(['a', 'b', 'c']);
    expect(plan.extent).toEqual({ r0: 0, c0: 0, r1: 1, c1: 1 });
  });
});

describe('fillPlan', () => {
  it('is null when the drag does not extend the block', () => {
    expect(fillPlan({ r0: 1, c0: 1, r1: 2, c1: 1 }, { r: 0, c: 0 })).toBeNull();
  });
  it('tiles a two-row block down, skipping the block itself', () => {
    const plan = fillPlan({ r0: 0, c0: 0, r1: 1, c1: 0 }, { r: 4, c: 0 })!;
    expect(plan.writes.map((w) => [w.r, w.fromR])).toEqual([
      [2, 0],
      [3, 1],
      [4, 0],
    ]);
    expect(plan.extent).toEqual({ r0: 0, c0: 0, r1: 4, c1: 0 });
  });
  it('extends right and down at once, from the matching source cell', () => {
    const plan = fillPlan({ r0: 0, c0: 0, r1: 0, c1: 0 }, { r: 1, c: 1 })!;
    expect(plan.writes.map((w) => [w.r, w.c, w.fromR, w.fromC])).toEqual([
      [0, 1, 0, 0],
      [1, 0, 0, 0],
      [1, 1, 0, 0],
    ]);
  });
  it('fillExtent never shrinks the source block', () => {
    expect(fillExtent({ r0: 2, c0: 2, r1: 3, c1: 3 }, { r: 0, c: 5 })).toEqual({ r0: 2, c0: 2, r1: 3, c1: 5 });
  });
});
