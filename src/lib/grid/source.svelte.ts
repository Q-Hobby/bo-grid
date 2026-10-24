import type { GridRow, SortState } from './column';
import type { RowRange, RowSource } from './source';
import type { AnyFilter } from './filtering';

/**
 * Drives a RowSource for the grid: fetches the visible window, caches rows by
 * index, tracks the total, and guards against stale responses. Cache is keyed by
 * the active sort+filter; changing either drops it (the index→row mapping moved).
 */
export class RowSourceController {
  total = $state(0);
  loading = $state(false);
  /** Bumped whenever cached rows change, so renderers can react. */
  version = $state(0);

  private readonly source: RowSource;
  private cache = new Map<number, GridRow>();
  private reqId = 0;
  private key = '';

  constructor(source: RowSource) {
    this.source = source;
  }

  rowAt(index: number): GridRow | null {
    return this.cache.get(index) ?? null;
  }

  private keyOf(
    sorts: readonly SortState[],
    filter: string,
    columnFilters: Record<string, AnyFilter> | undefined,
    quickFilter: string,
  ): string {
    const cf = columnFilters ? JSON.stringify(columnFilters) : '';
    return JSON.stringify([sorts.map((s) => `${s.key}:${s.dir}`), filter, quickFilter, cf]);
  }

  async fetch(
    range: RowRange,
    sorts: SortState[],
    filter: string,
    columnFilters?: Record<string, AnyFilter>,
    quickFilter = '',
  ): Promise<void> {
    const key = this.keyOf(sorts, filter, columnFilters, quickFilter);
    if (key !== this.key) {
      this.key = key;
      this.cache.clear();
      this.total = 0;
      this.version++;
    }

    let missing = false;
    for (let i = range.start; i < range.end; i++) {
      if (!this.cache.has(i)) {
        missing = true;
        break;
      }
    }
    if (!missing) return;

    const id = ++this.reqId;
    this.loading = true;
    const res = await this.source.getRows({ range, sort: sorts[0] ?? null, sorts, filter, quickFilter, columnFilters });
    if (id !== this.reqId) return; // a newer request superseded this one

    this.total = res.total;
    for (let i = 0; i < res.rows.length; i++) {
      this.cache.set(range.start + i, res.rows[i]);
    }
    this.loading = false;
    this.version++;
  }
}
