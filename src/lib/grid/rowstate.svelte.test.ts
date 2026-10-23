// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { RowState } from './rowstate.svelte';

let stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  localStorage.clear();
});

function create(persistKey?: string): RowState {
  let state!: RowState;
  stops.push($effect.root(() => void (state = new RowState(() => persistKey))));
  flushSync();
  return state;
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('RowState selection', () => {
  it('toggles ids and keeps the order they were selected in', () => {
    const s = create();
    s.toggleSelected(2);
    s.toggleSelected(1);
    expect(s.selectedIds()).toEqual([2, 1]);
    s.toggleSelected(2);
    expect(s.isSelected(2)).toBe(false);
    s.setSelected([3, 4], true);
    s.setSelected([1], false);
    expect(s.selectedIds()).toEqual([3, 4]);
    expect(s.selectionVersion).toBe(5);
  });
});

describe('RowState expansion and loading', () => {
  it('loads on the first expand, keeps the rows, and does not load again', async () => {
    const s = create();
    const load = vi.fn().mockResolvedValue([{ id: 9 }]);
    s.toggleLoaded('g', load);
    expect(s.isExpanded('g')).toBe(true);
    expect(s.isLoading('g')).toBe(true);
    await settle();
    expect(s.isLoading('g')).toBe(false);
    expect(s.loadedRows('g')).toEqual([{ id: 9 }]);
    s.toggleLoaded('g', load);
    s.toggleLoaded('g', load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed load collapses again so the next expand retries', async () => {
    const s = create();
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    s.toggleLoaded(1, load);
    await settle();
    expect(s.isExpanded(1)).toBe(false);
    s.toggleLoaded(1, load);
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    expect(s.loadedRows(1)).toEqual([]);
  });

  it('expanding while a load is in flight starts no second load', () => {
    const s = create();
    const load = vi.fn(() => new Promise<never>(() => {}));
    s.toggleLoaded(1, load);
    s.toggleLoaded(1, load); // collapse
    s.toggleLoaded(1, load); // expand again, still loading
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('toggles collapsed groups and expanded rows', () => {
    const s = create();
    s.toggleCollapsed('a');
    expect(s.collapsed.has('a')).toBe(true);
    s.toggleCollapsed('a');
    expect(s.collapsed.has('a')).toBe(false);
    s.toggleExpanded(5);
    expect(s.isExpanded(5)).toBe(true);
  });
});

describe('RowState pinned rows', () => {
  it('saves pins and restores them, dropping bad ids', () => {
    create('t').setPinned([3, 'x']);
    expect(create('t').pinned).toEqual([3, 'x']);
    localStorage.setItem('bo-grid:rowpin:u', JSON.stringify([1, null, {}, 'y']));
    expect(create('u').pinned).toEqual([1, 'y']);
  });
});
