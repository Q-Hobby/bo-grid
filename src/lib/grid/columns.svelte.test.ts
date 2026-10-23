// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { createColumnState, type ColumnState } from './columns.svelte';

let stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  localStorage.clear();
});

/** A ColumnState created inside an effect root, as a component would. */
function create(persistKey: string | undefined, count: number) {
  let cols = $state(Array.from({ length: count }, (_, i) => i));
  let state!: ColumnState;
  stops.push(
    $effect.root(() => {
      state = createColumnState(() => persistKey, () => cols);
    }),
  );
  flushSync();
  return { state, setColumns: (n: number) => ((cols = Array.from({ length: n }, (_, i) => i)), flushSync()) };
}

describe('ColumnState', () => {
  it('starts in the given order and moves columns, saving the order', () => {
    const { state } = create('t', 3);
    expect(state.order).toEqual([0, 1, 2]);
    state.move(0, 2);
    expect(state.order).toEqual([1, 2, 0]);
    expect(JSON.parse(localStorage.getItem('bo-grid:order:t')!)).toEqual([1, 2, 0]);
    state.move(1, 1);
    expect(state.order).toEqual([1, 2, 0]);
  });

  it('restores a saved order, and ignores one that does not fit the columns', () => {
    localStorage.setItem('bo-grid:order:t', JSON.stringify([2, 0, 1]));
    expect(create('t', 3).state.order).toEqual([2, 0, 1]);
    expect(create('t', 4).state.order).toEqual([0, 1, 2, 3]);
  });

  it('a new column set resets the order', () => {
    const { state, setColumns } = create(undefined, 3);
    state.move(0, 2);
    setColumns(2);
    expect(state.order).toEqual([0, 1]);
  });

  it('a new column set of the same length resets the order too', () => {
    const { state, setColumns } = create(undefined, 3);
    state.move(0, 2);
    setColumns(3); // a different array with as many columns
    expect(state.order).toEqual([0, 1, 2]);
  });

  it('sets and resets widths, saving each change', () => {
    const { state } = create('t', 2);
    state.setWidth('px', 120);
    expect(JSON.parse(localStorage.getItem('bo-grid:widths:t')!)).toEqual({ px: 120 });
    expect(state.resetWidth('px')).toBe(true);
    expect(state.widths).toEqual({});
    expect(state.resetWidth('px')).toBe(false);
  });

  it('a pin set from the menu wins over the column\'s own', () => {
    const { state } = create(undefined, 1);
    expect(state.pinSideOf('a', true)).toBe('left');
    expect(state.pinSideOf('a', 'right')).toBe('right');
    expect(state.pinSideOf('a', undefined)).toBe(false);
    state.setPin('a', false);
    expect(state.pinSideOf('a', 'right')).toBe(false);
  });

  it('restores saved widths, hidden and pinned columns, dropping bad entries', () => {
    localStorage.setItem('bo-grid:widths:t', JSON.stringify({ px: 90 }));
    localStorage.setItem('bo-grid:hidden:t', JSON.stringify(['vol', 7]));
    localStorage.setItem('bo-grid:pin:t', JSON.stringify({ sym: 'left' }));
    const { state } = create('t', 2);
    expect(state.widths).toEqual({ px: 90 });
    expect(state.hidden).toEqual(['vol']);
    expect(state.pins).toEqual({ sym: 'left' });
  });
});
