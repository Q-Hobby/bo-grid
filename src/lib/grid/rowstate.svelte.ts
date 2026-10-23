// Per-row state the user changes, keyed by row id (or group key / path) so it
// survives sorting and filtering: whole-row selection, collapsed groups,
// expanded rows (master-detail, tree nodes, server-side groups), the children
// and group rows loaded on expand, and the rows pinned above the scroll (saved
// under persistKey). Create it while the grid initialises: the constructor's
// effect reloads the pinned rows when persistKey changes.
//
// The sets are plain, each with a $state version that readers track: toggling
// one row bumps one number instead of rebuilding a reactive set.
import { untrack } from 'svelte';
import type { GridRow } from './column';
import { loadSaved, saveValue, storageKey } from './persist';

type RowKey = string | number;

export class RowState {
  private readonly selected = new Set<RowKey>();
  private readonly expanded = new Set<RowKey>();
  private readonly loaded = new Map<RowKey, GridRow[]>();
  private readonly loading = new Set<RowKey>();
  /** Collapsed group paths (client-side grouping). */
  readonly collapsed = new Set<string>();
  /** Bumped when the row selection changes. */
  selectionVersion = $state(0);
  /** Bumped when a group collapses or expands. */
  collapseVersion = $state(0);
  /** Bumped when a row or group expands or collapses. */
  expandVersion = $state(0);
  /** Bumped when a load starts, finishes or fails. */
  loadVersion = $state(0);
  /** Row ids pinned above the scroll, in pin order. */
  pinned = $state<RowKey[]>([]);

  constructor(private readonly persistKey: () => string | undefined) {
    $effect(() => {
      const key = storageKey('rowpin', this.persistKey());
      untrack(() => {
        const saved = loadSaved(key);
        if (Array.isArray(saved)) this.pinned = saved.filter((id) => typeof id === 'string' || typeof id === 'number');
      });
    });
  }

  // ---- Row selection --------------------------------------------------------

  isSelected(id: RowKey): boolean {
    this.selectionVersion;
    return this.selected.has(id);
  }

  /** The selected ids, in the order they were selected. */
  selectedIds(): RowKey[] {
    return [...this.selected];
  }

  toggleSelected(id: RowKey): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.selectionVersion++;
  }

  setSelected(ids: Iterable<RowKey>, on: boolean): void {
    for (const id of ids) {
      if (on) this.selected.add(id);
      else this.selected.delete(id);
    }
    this.selectionVersion++;
  }

  // ---- Grouping, expansion and loading ---------------------------------------

  toggleCollapsed(path: string): void {
    if (this.collapsed.has(path)) this.collapsed.delete(path);
    else this.collapsed.add(path);
    this.collapseVersion++;
  }

  isExpanded(id: RowKey): boolean {
    this.expandVersion;
    return this.expanded.has(id);
  }

  toggleExpanded(id: RowKey): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    this.expandVersion++;
  }

  /** Expands or collapses `id`. On an expand with nothing loaded or loading
      yet, `load` (when given) fetches its rows, kept once loaded; a failed
      load collapses it again, so expanding retries. */
  toggleLoaded(id: RowKey, load?: () => Promise<GridRow[]> | GridRow[]): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
      this.expandVersion++;
      return;
    }
    this.expanded.add(id);
    this.expandVersion++;
    if (!load || this.loaded.has(id) || this.loading.has(id)) return;
    this.loading.add(id);
    this.loadVersion++;
    Promise.resolve(load()).then(
      (rows) => {
        this.loaded.set(id, rows);
        this.loading.delete(id);
        this.loadVersion++;
      },
      () => {
        this.loading.delete(id);
        this.expanded.delete(id);
        this.expandVersion++;
        this.loadVersion++;
      },
    );
  }

  /** The rows loaded for `id`, if any. */
  loadedRows(id: RowKey): GridRow[] | undefined {
    return this.loaded.get(id);
  }

  isLoading(id: RowKey): boolean {
    return this.loading.has(id);
  }

  // ---- Pinned rows ------------------------------------------------------------

  setPinned(next: RowKey[]): void {
    this.pinned = next;
    saveValue(storageKey('rowpin', this.persistKey()), next);
  }
}
