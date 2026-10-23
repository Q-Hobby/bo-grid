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
//   - A field with an update rate (a column's `updateMs`) is bumped at most
//     that often: the first change after a quiet spell at once, the rest on
//     the rate's next beat, one timer per rate while anything waits. A row
//     whose changed fields all wait waits for its row version too.
// The version maps are $state records, not SvelteMaps: reading a missing key
// of a proxied object subscribes to that key alone, so bumping one row (or one
// field) never wakes the others. The price: a proxy keeps the signal of every
// key ever read, missing ones included, and a delete does not drop it, so a
// grid that draws many rows over a session (a blotter's churn, a long scroll)
// would keep one per row and cell it ever drew. renew() swaps in fresh
// records: every reader reads once more, and the old signals go with the old
// records.
//
// A factory rather than a class: its state stays in local variables, which
// minify; a class's $state fields compile to named accessors, which do not.
import type { FlashCellsOptions } from './api';
import type { GridRow } from './column';
import type { CellFlash } from './flash';
import { patchRowsInPlace } from './patch';

type RowKey = string | number;

/** renew() keeps the flash requests younger than this (ms), or than their own
    window when it is longer, so a flash on screen plays out. */
const FLASH_KEEP_MS = 10_000;

export interface LiveRows {
  /** Bumped once per patch call that changed something. */
  readonly dataVersion: number;
  rowVersion(key: RowKey): number | undefined;
  fieldVersion(key: RowKey, field: string): number | undefined;
  cellFlash(key: RowKey): CellFlash | null;
  /** Writes each patch into its row (looked up in `index`) and wakes the
      `rendered` rows it changed, each once even when it is rendered twice (a
      pinned row can also be on screen in the body). Returns how many rows
      changed. `onChanged` hears which fields changed, per row key. `rates`
      holds the fields that repaint at most every so many ms. */
  patch(
    index: ReadonlyMap<RowKey, GridRow>,
    patches: Iterable<readonly [RowKey, Record<string, unknown>]>,
    rendered: Iterable<GridRow>,
    idOf: (row: GridRow) => RowKey,
    onChanged?: (changed: ReadonlyMap<RowKey, ReadonlySet<string>>) => void,
    rates?: ReadonlyMap<string, number>,
  ): number;
  /** Starts an on-demand flash on the `rendered` rows that `opts.rows` names
      (all when omitted), each id once. Rows off screen are skipped, as a tick
      off screen never shows either. `hold` may be decided from how many rows
      flash and how many of their columns (null: all). Returns how many rows
      flash. */
  flash(
    opts: FlashCellsOptions,
    rendered: Iterable<GridRow>,
    idOf: (row: GridRow) => RowKey,
    at: number,
    hold: boolean | ((rows: number, columns: number | null) => boolean) | undefined,
  ): number;
  /** Starts the version records afresh, dropping the signals that the rows
      drawn so far left behind; flash requests still playing at `now` carry
      over. Every reader reads once more (a missing version reads as none). */
  renew(now: number): void;
  /** Drops what waits for an update rate's beat (the grid is going away). */
  stop(): void;
}

/** The fields and rows that wait for one update rate's next beat. */
interface Beat {
  /** When the rate last repainted. */
  last: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  fields: Set<string>;
  rows: Set<RowKey>;
}

const fieldKey = (row: RowKey, field: string): string => `${row}\u0001${field}`;

export function createLiveRows(): LiveRows {
  let rowVersions: Record<string, number> = $state({});
  let fieldVersions: Record<string, number> = $state({});
  // On-demand flashes: the latest request per rendered row in a plain map, and
  // a per-row counter, read like rowVersions, that wakes that row's cells alone.
  let flashSeq: Record<string, number> = $state({});
  const flashes = new Map<RowKey, CellFlash>();
  let dataVersion = $state(0);
  const beats = new Map<number, Beat>();

  const bumpRow = (key: RowKey) => (rowVersions[key] = (rowVersions[key] ?? 0) + 1);
  const bumpField = (fk: string) => (fieldVersions[fk] = (fieldVersions[fk] ?? 0) + 1);
  /** The beat of rate `ms` at `now`, or null when it may repaint now: the
      first change after a quiet spell, and every change in the same call. */
  function waitFor(ms: number, now: number): Beat | null {
    let beat = beats.get(ms);
    if (!beat) beats.set(ms, (beat = { last: -Infinity, timer: undefined, fields: new Set(), rows: new Set() }));
    if (beat.timer === undefined && (beat.last === now || now - beat.last >= ms)) {
      beat.last = now;
      return null;
    }
    if (beat.timer === undefined) {
      const b = beat;
      b.timer = setTimeout(() => {
        b.timer = undefined;
        b.last = Date.now();
        for (const fk of b.fields) bumpField(fk);
        for (const key of b.rows) bumpRow(key);
        b.fields.clear();
        b.rows.clear();
      }, beat.last + ms - now);
    }
    return beat;
  }

  return {
    get dataVersion() {
      return dataVersion;
    },
    rowVersion: (key) => rowVersions[key],
    fieldVersion: (key, field) => fieldVersions[fieldKey(key, field)],
    cellFlash: (key) => (flashSeq[key] ? (flashes.get(key) ?? null) : null),
    patch(index, patches, rendered, idOf, onChanged, rates) {
      const changed = patchRowsInPlace(index, patches);
      if (changed.size === 0) return 0;
      onChanged?.(changed);
      const now = rates ? Date.now() : 0;
      const bumped = new Set<RowKey>();
      for (const row of rendered) {
        const key = idOf(row);
        const fields = changed.get(key);
        if (!fields || bumped.has(key)) continue;
        bumped.add(key);
        let waiting: Beat | null = null;
        let shown = false;
        for (const f of fields) {
          const fk = fieldKey(key, f);
          const ms = rates?.get(f);
          const beat = ms ? waitFor(ms, now) : null;
          if (beat) {
            beat.fields.add(fk);
            waiting = beat;
          } else {
            bumpField(fk);
            shown = true;
          }
        }
        if (shown) bumpRow(key);
        else waiting?.rows.add(key);
      }
      dataVersion++;
      return changed.size;
    },
    flash(opts, rendered, idOf, at, hold) {
      const wanted = opts.rows ? new Set(opts.rows) : null;
      const columns = opts.columns ? new Set(opts.columns) : null;
      const done = new Set<RowKey>();
      for (const row of rendered) {
        const key = idOf(row);
        if (!wanted || wanted.has(key)) done.add(key);
      }
      if (done.size === 0) return 0;
      const held = typeof hold === 'function' ? hold(done.size, columns ? columns.size : null) : hold;
      for (const key of done) {
        const seq = (flashes.get(key)?.seq ?? 0) + 1;
        flashes.set(key, { seq, dir: opts.dir ?? 'same', at, ms: opts.ms, columns, hold: held });
        flashSeq[key] = seq;
      }
      return done.size;
    },
    renew(now) {
      rowVersions = {};
      fieldVersions = {};
      const seq: Record<string, number> = {};
      for (const [key, f] of flashes) {
        if (now - f.at < Math.max(f.ms ?? 0, FLASH_KEEP_MS)) seq[key] = f.seq;
        else flashes.delete(key);
      }
      flashSeq = seq;
    },
    stop() {
      for (const beat of beats.values()) clearTimeout(beat.timer);
      beats.clear();
    },
  };
}
