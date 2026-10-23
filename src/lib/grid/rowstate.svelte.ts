// Per-row state the user changes, keyed by row id (or group key / path) so it
// survives sorting and filtering: whole-row selection, collapsed groups,
// expanded rows (master-detail, tree nodes, server-side groups), the children
// and group rows loaded on expand, and the rows pinned above the scroll (saved
// under persistKey). Create it while the grid initialises: its effect reloads
// the pinned rows when persistKey changes.
//
// The sets are plain, each with a $state version that readers track: toggling
// one row bumps one number instead of rebuilding a reactive set. A factory
// rather than a class, so its state stays in local variables, which minify.
import { untrack } from 'svelte';
import type { GridRow } from './column';
import { loadSaved, saveValue, storageKey } from './persist';

type RowKey = string | number;

export interface RowState {
  /** Bumped when the row selection changes. */
  readonly selectionVersion: number;
  /** Bumped when a group collapses or expands. */
  readonly collapseVersion: number;
  /** Bumped when a row or group expands or collapses. */
  readonly expandVersion: number;
  /** Bumped when a load starts, finishes or fails. */
  readonly loadVersion: number;
  /** Row ids pinned above the scroll, in pin order. */
  readonly pinned: RowKey[];
  /** Collapsed group paths (client-side grouping). */
  readonly collapsed: ReadonlySet<string>;
  isSelected(id: RowKey): boolean;
  /** The selected ids, in the order they were selected. */
  selectedIds(): RowKey[];
  toggleSelected(id: RowKey): void;
  setSelected(ids: Iterable<RowKey>, on: boolean): void;
  toggleCollapsed(path: string): void;
  isExpanded(id: RowKey): boolean;
  toggleExpanded(id: RowKey): void;
  /** Expands or collapses `id`. On an expand with nothing loaded or loading
      yet, `load` (when given) fetches its rows, kept once loaded; a failed
      load collapses it again, so expanding retries. */
  toggleLoaded(id: RowKey, load?: () => Promise<GridRow[]> | GridRow[]): void;
  /** The rows loaded for `id`, if any. */
  loadedRows(id: RowKey): GridRow[] | undefined;
  isLoading(id: RowKey): boolean;
  setPinned(next: RowKey[]): void;
}

export function createRowState(persistKey: () => string | undefined): RowState {
  const selected = new Set<RowKey>();
  const expanded = new Set<RowKey>();
  const loaded = new Map<RowKey, GridRow[]>();
  const loading = new Set<RowKey>();
  const collapsed = new Set<string>();
  let selectionVersion = $state(0);
  let collapseVersion = $state(0);
  let expandVersion = $state(0);
  let loadVersion = $state(0);
  let pinned = $state<RowKey[]>([]);

  $effect(() => {
    const key = storageKey('rowpin', persistKey());
    untrack(() => {
      const saved = loadSaved(key);
      if (Array.isArray(saved)) pinned = saved.filter((id) => typeof id === 'string' || typeof id === 'number');
    });
  });

  const toggle = <K>(set: Set<K>, k: K) => (set.has(k) ? set.delete(k) : set.add(k));

  return {
    get selectionVersion() {
      return selectionVersion;
    },
    get collapseVersion() {
      return collapseVersion;
    },
    get expandVersion() {
      return expandVersion;
    },
    get loadVersion() {
      return loadVersion;
    },
    get pinned() {
      return pinned;
    },
    collapsed,
    isSelected(id) {
      selectionVersion;
      return selected.has(id);
    },
    selectedIds: () => [...selected],
    toggleSelected(id) {
      toggle(selected, id);
      selectionVersion++;
    },
    setSelected(ids, on) {
      for (const id of ids) {
        if (on) selected.add(id);
        else selected.delete(id);
      }
      selectionVersion++;
    },
    toggleCollapsed(path) {
      toggle(collapsed, path);
      collapseVersion++;
    },
    isExpanded(id) {
      expandVersion;
      return expanded.has(id);
    },
    toggleExpanded(id) {
      toggle(expanded, id);
      expandVersion++;
    },
    toggleLoaded(id, load) {
      if (expanded.has(id)) {
        expanded.delete(id);
        expandVersion++;
        return;
      }
      expanded.add(id);
      expandVersion++;
      if (!load || loaded.has(id) || loading.has(id)) return;
      loading.add(id);
      loadVersion++;
      Promise.resolve(load()).then(
        (rows) => {
          loaded.set(id, rows);
          loading.delete(id);
          loadVersion++;
        },
        () => {
          loading.delete(id);
          expanded.delete(id);
          expandVersion++;
          loadVersion++;
        },
      );
    },
    loadedRows: (id) => loaded.get(id),
    isLoading: (id) => loading.has(id),
    setPinned(next) {
      pinned = next;
      saveValue(storageKey('rowpin', persistKey()), next);
    },
  };
}
