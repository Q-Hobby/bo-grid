// The realtime path behind `api.patchRows` and `api.flashCells`.
//
// Rows can be plain objects: patch() writes ticks into them directly (a
// fraction of the cost of writing through $state proxies) and repaints only
// the rendered rows it touched, by bumping versions their cells read. Rows off
// screen pay nothing reactive; they read current values when they mount.
//   - rowVersion: bumped once per patch that changes the row. Drives row-aware
//     work (cellClass, format or tooltip that read the row, renderers).
//   - fieldVersion: bumped per changed field, so a tick that moves two fields
//     repaints two cells, not the whole row.
//   - dataVersion: bumped once per patch call, for whole-view readers (footer
//     totals, group subtotals, selection aggregates, conditional-format
//     ranges).
// The version maps are $state records, not SvelteMaps: reading a missing key
// of a proxied object subscribes to that key alone, so bumping one row (or one
// field) never wakes the others.
import type { FlashCellsOptions } from './api';
import type { GridRow } from './column';
import type { CellFlash } from './flash';
import { patchRowsInPlace } from './patch';

type RowKey = string | number;

const fieldKey = (row: RowKey, field: string): string => `${row}\u0001${field}`;

export class LiveRows {
  private readonly rowVersions: Record<string, number> = $state({});
  private readonly fieldVersions: Record<string, number> = $state({});
  // On-demand flashes: the latest request per rendered row in a plain map, and
  // a per-row counter, read like rowVersions, that wakes that row's cells alone.
  private readonly flashSeq: Record<string, number> = $state({});
  private readonly flashes = new Map<RowKey, CellFlash>();
  dataVersion = $state(0);

  rowVersion(key: RowKey): number | undefined {
    return this.rowVersions[key];
  }

  fieldVersion(key: RowKey, field: string): number | undefined {
    return this.fieldVersions[fieldKey(key, field)];
  }

  cellFlash(key: RowKey): CellFlash | null {
    return this.flashSeq[key] ? (this.flashes.get(key) ?? null) : null;
  }

  /** Writes each patch into its row (looked up in `index`) and wakes the
      `rendered` rows it changed, each once even when it is rendered twice (a
      pinned row can also be on screen in the body). Returns how many rows
      changed. */
  patch(
    index: ReadonlyMap<RowKey, GridRow>,
    patches: Iterable<readonly [RowKey, Record<string, unknown>]>,
    rendered: Iterable<GridRow>,
    idOf: (row: GridRow) => RowKey,
  ): number {
    const changed = patchRowsInPlace(index, patches);
    if (changed.size === 0) return 0;
    const bumped = new Set<RowKey>();
    for (const row of rendered) {
      const key = idOf(row);
      const fields = changed.get(key);
      if (!fields || bumped.has(key)) continue;
      bumped.add(key);
      this.rowVersions[key] = (this.rowVersions[key] ?? 0) + 1;
      for (const f of fields) {
        const fk = fieldKey(key, f);
        this.fieldVersions[fk] = (this.fieldVersions[fk] ?? 0) + 1;
      }
    }
    this.dataVersion++;
    return changed.size;
  }

  /** Starts an on-demand flash on the `rendered` rows that `opts.rows` names
      (all when omitted), each id once. Rows off screen are skipped, as a tick
      off screen never shows either. Returns how many rows flash. */
  flash(
    opts: FlashCellsOptions,
    rendered: Iterable<GridRow>,
    idOf: (row: GridRow) => RowKey,
    at: number,
    hold: boolean | undefined,
  ): number {
    const wanted = opts.rows ? new Set(opts.rows) : null;
    const columns = opts.columns ? new Set(opts.columns) : null;
    const done = new Set<RowKey>();
    for (const row of rendered) {
      const key = idOf(row);
      if ((wanted && !wanted.has(key)) || done.has(key)) continue;
      done.add(key);
      const seq = (this.flashes.get(key)?.seq ?? 0) + 1;
      this.flashes.set(key, { seq, dir: opts.dir ?? 'same', at, ms: opts.ms, columns, hold });
      this.flashSeq[key] = seq;
    }
    return done.size;
  }
}
