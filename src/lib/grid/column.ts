import type { Component } from 'svelte';
import type { Candle } from '../types';
import { fmtPrice, fmtPercent, fmtVolume, fmtDate, fmtCurrency, relativeTime, type DateStyle } from '../format/format';
import type { AggKind } from './aggregate';
import type { FilterKind } from './filtering';

export type Align = 'left' | 'right';

/** `showChange` options: the delta's text and how long it stays. */
export interface ShowChangeOptions {
  /** Text for a change; gets the signed delta (new − old) and the row.
      Default: `▲` / `▼` and the size in the column's own format. */
  format?: (delta: number, row: GridRow) => string;
  /** How long the delta shows, fade included, in ms. Default 1000. */
  ms?: number;
}

export interface ColBase {
  /** Field on the row to read for this column's value. */
  key: string;
  /** The column's title in the header row. */
  header: string;
  /** BCP 47 locale for this column's built-in formatting (`price`, `date`,
      `currency`, `relative`). Defaults to the grid's `locale`, then `en-US`. */
  locale?: string;
  /** Computed value: derive this cell's value from the whole row instead of
      reading `row[key]` (KPIs, ratios, deltas). Flows through display, sort,
      filter, aggregation, export and conditional formatting. `key` still names
      the column (and is the sort/filter key) but need not be a real row field.
      Keep it cheap and pure — it's called during sort/filter. Computed columns
      aren't editable. In-memory mode (a server source owns its own derivations). */
  value?: (row: GridRow) => unknown;
  /** Merge this column's cell down over adjacent rows. `true` joins rows with
      equal (non-blank) values; a function decides for each adjacent pair.
      Hierarchical: a run also breaks wherever a spanning column to its left
      breaks, and at group headers. A drawing rule only — sort, filter, copy and
      export still see every row's own value. In-memory mode only. */
  spanRows?: boolean | ((a: GridRow, b: GridRow) => boolean);
  /** How many columns this cell covers for a given row (default 1). Covered
      cells are not drawn. Clamped at a pinned/scrolling boundary and the last
      column; the leftmost claim wins. Ignored under `virtualizeColumns`. */
  colSpan?: (row: GridRow) => number;
  /** Fixed width in px. Ignored when `flex` is set. */
  width?: number;
  /** Smallest width (px) a drag-resize can give this column. */
  minWidth?: number;
  /** Largest width (px) a drag-resize can give this column. */
  maxWidth?: number;
  /** flex-grow weight; column stretches to fill remaining space. */
  flex?: number;
  /** Which side the header, cells and footer sit on. Defaults to right for
      number types and left for the rest; set it to line a custom column's
      values up under its title. */
  align?: Align;
  /** Extra class(es) for this column's data cells — a static string, or a
      function of the cell value/row for conditional styling. Target via
      `:global(.bo-grid .c.your-class)`. */
  cellClass?: string | ((value: unknown, row: GridRow) => string | undefined);
  /** Extra class(es) for this column's header. Target via `:global`. */
  headerClass?: string;
  /** Show a styled tooltip on the column header (the same themed bubble as cell
      `tooltip`) — describe what the column means, units, caveats. Hovering
      anywhere on the header reveals it. */
  headerTooltip?: string;
  /** Render a small ⓘ info icon in the header as a visible cue that a
      `headerTooltip` is available. Ignored without `headerTooltip`. */
  headerInfo?: boolean;
  /** Flash the cell when its value changes.
      - `'auto'` (alias `'up-down'`) — the grid derives it: green on a rise, red
        on a fall, per cell. Nothing to maintain in app code; just stream new
        values in. This is what you want for a live price board.
      - `'change'` — a neutral flash on any change, numeric or not (status, qty).
      - `true` — legacy row-driven mode: the flash follows the row's own
        `flashSeq`/`flashDir`, so every `flash: true` column in a row flashes
        together, in one direction, and you bump the counter yourself.
      Derived modes never flash on first paint or when a row scrolls into view. */
  flash?: boolean | 'auto' | 'up-down' | 'change';
  /** Flash duration in ms — **derived modes only** (`'auto'`/`'up-down'`/
      `'change'`); has no effect on legacy `flash: true`, which flashes for the
      CSS animation's fixed duration regardless. Default 300. Raise it for a
      slow feed, lower it for a fast one so flashes don't smear together. */
  flashMs?: number;
  /** Tint the text in the tick's direction while flashing (default true). Set
      false when the column colours its own text — e.g. price-limit tones on a
      VN board (ceiling / floor / reference) — so the flash only lights the
      background. */
  flashColor?: boolean;
  /** Show the size of each change beside the value for a moment — `▲0.15` in
      the up colour, `▼` down — held, then faded. The delta is the last change,
      written in the column's own format. Numeric values only; first paint and
      rows scrolling into view show nothing. `{ format, ms }` sets the text
      (`format(delta, row)` gets the signed change) and how long it shows
      (default 1000 ms). In a narrow column the delta gives way first: the
      value itself is never cut for it. Meant for one or two key columns (the
      match price): each change runs a short animation, so a busy board with
      it on every column pays real frame time. */
  showChange?: boolean | ShowChangeOptions;
  /** Repaint this column at most every this many ms under `api.patchRows`.
      Each tick is still written into the row at once (sort, filters, totals
      and other columns see it), but the cell shows the latest value on its
      next beat: a value that changes on every tick and is read at a glance
      (total volume, foreign buy and sell) stops repainting every frame. The
      first change after a quiet spell shows at once. A flash or `showChange`
      plays on the repaint, against the value shown before. For the field the
      column shows (`key`), not a `value` column; when several columns show a
      field, it waits only if they all set this. */
  updateMs?: number;
  /** Set false to disable header-click sorting on this column. */
  sortable?: boolean;
  /** Custom ascending comparator for this column's values (e.g. enum priority or
      natural sort). Direction is applied by the grid. In-memory mode only. */
  compare?: (a: unknown, b: unknown) => number;
  /** When grouping is active, show this aggregate of the column on group headers. */
  groupAgg?: AggKind;
  /** Pin this column so it stays visible during horizontal scroll. `true` /
      `'left'` pins to the left edge, `'right'` to the right. */
  pinned?: boolean | 'left' | 'right';
  /** Allow inline editing (double-click or Enter on the focused cell). */
  editable?: boolean;
  /** Validate an edited value before it commits (inline edit, custom editor,
      paste, fill). Return false to reject and keep the old value. Receives the
      parsed value. */
  validate?(value: unknown, row: GridRow): boolean;
  /** Turn typed or pasted text into the stored value (runs before the built-in
      number/date coercion, which it replaces). Return `undefined` or a
      non-finite number to reject the input. */
  parse?: (raw: string, row: GridRow) => unknown;
  /** Svelte component that edits this cell in place of the built-in input.
      Makes any column type editable (with `editable: true`), including display
      widgets like `rating` or `tags`. It calls `commit(value)` to save — any
      value, no parsing — or `cancel()`; Escape cancels. */
  editor?: Component<CellEditorProps>;
  /** Editable choices: when set, editing renders a `<select>` of these options
      instead of a text input (enum/status columns). */
  options?: string[];
  /** Show a styled floating tooltip on each cell (themed, instant — replaces the
      native `title`). `true` shows the full formatted value (handy when content
      truncates); a function returns custom text per value/row (any column type,
      including `custom`). Return '' to suppress for a given cell. */
  tooltip?: boolean | ((value: unknown, row: GridRow) => string);
  /** Let long content wrap to multiple lines instead of truncating with an
      ellipsis. Pair with a taller `rowHeight`. Default false (single-line +
      ellipsis). */
  wrap?: boolean;
  /** Custom display formatter, overriding the built-in type formatter. Applies
      to display, tooltip, copy and (formatted) export. `row` is absent for
      aggregate cells. */
  format?: (value: unknown, row?: GridRow) => string;
  /** JS cell renderer — the framework-agnostic alternative to the `cell`
      snippet, for React/Vue/vanilla (and the `<bo-grid>` web component). Return
      an `HTMLElement`/`Node` (safe — appended as-is) or an HTML **string**
      (inserted as innerHTML — YOU must sanitize any untrusted data; prefer
      returning a Node for that). Overrides the cell's display only — sort,
      filter, tooltip, copy and export still use the value/`format`. */
  render?: (ctx: CellRenderContext) => string | Node | null | undefined;
  /** Svelte component that draws this cell (receives `value`, `row`, `column`
      and the formatted `text`). Display only, like `render`. Usually supplied by
      a registered `cellTypes` entry, but any column can set it. It updates in
      place as its props change; under `api.patchRows`, `row` is a fresh view of
      the patched row on each patch (same fields, new identity), so read it
      reactively (`$derived`, markup) rather than once at mount. */
  component?: Component<CellTypeProps>;
  /** Set false to disable drag-to-resize on this column (default on). */
  resizable?: boolean;
  /** Widen the column when a value on screen no longer fits (a price gaining a
      digit, a running total), checked at most every 500 ms. It only grows, so
      values flickering wider and narrower don't make it jump; `maxWidth` caps
      it, and a width the user dragged or autosized takes over. */
  autoWidth?: boolean;
  /** Parent header label. Consecutive columns sharing a `group` render under a
      spanning header, which keeps the width of its columns (flex ones too). */
  group?: string;
  /** Header filter-menu control for this column (requires `filterMenu` on
      <Grid>). Defaults to the column's type; `'set'` shows a value checklist;
      `false` disables filtering for this column. */
  filter?: false | FilterKind | (string & {});
  /** Conditional formatting — a horizontal bar painted behind the cell value,
      scaled across the column's value range. The range is auto-computed over the
      current view (in-memory) unless `min`/`max` are given; pass `min: 0` for
      absolute proportional bars. Bars cross a zero baseline when the range spans
      negatives. Numeric columns only. */
  dataBar?: DataBarConfig;
  /** Conditional formatting — show an icon beside the value, chosen by the
      highest threshold `at` that is ≤ the cell value (e.g. ▲ ● ▼ by sign or band).
      Numeric columns only. */
  icons?: IconRule[];
  /** Conditional formatting — tint the cell background across the column's value
      range (a soft heat ramp). Auto-ranged over the current view unless `min`/
      `max` are given; pass `mid` for a 3-stop diverging scale (e.g. `mid: 0`).
      Numeric columns only. */
  colorScale?: ColorScaleConfig;
}

/** Conditional-formatting data-bar config (see `ColBase.dataBar`). */
export interface DataBarConfig {
  min?: number;
  max?: number;
  /** Bar colour for values ≥ 0 (default `--bo-up`). Any CSS colour or var. */
  color?: string;
  /** Bar colour for values < 0 (default `--bo-down`). */
  negative?: string;
}

/** Conditional-formatting colour-scale config (see `ColBase.colorScale`). */
export interface ColorScaleConfig {
  min?: number;
  /** Midpoint for a 3-stop diverging scale (e.g. `0`). Omit for a 2-stop scale. */
  mid?: number;
  max?: number;
  /** Stop colours — `[low, high]` (2-stop) or `[low, mid, high]` (3-stop). Any
      CSS colour or var. Defaults to a soft, translucent theme ramp (up tint for
      high; down→up diverging when `mid` is set). */
  colors?: [string, string] | [string, string, string];
}

/** A single icon-set threshold rule (see `ColBase.icons`). */
export interface IconRule {
  /** Lower bound: this rule wins when `value >= at` and `at` is the greatest
      such threshold. */
  at: number;
  icon: string;
  tone?: BadgeTone;
}

/** Resolved data-bar geometry as fractions of the cell width (0..1). */
export interface DataBarGeom {
  /** Distance of the bar's left edge from the cell's left edge. */
  left: number;
  /** Bar width. */
  width: number;
  /** The value is negative (use the bar's `negative` colour). */
  negative: boolean;
}

/** Context passed to a column's JS `render` hook. */
export interface CellRenderContext {
  value: unknown;
  row: GridRow;
  column: ColumnDef;
}

export interface CellEditEvent {
  row: GridRow;
  column: ColumnDef;
  /** The new value: a number for numeric columns, epoch ms for `date`, the
      result of the column's `parse` when set, whatever a custom `editor`
      committed, otherwise the typed string. */
  value: unknown;
}

/** Props a custom cell `editor` component receives. */
export interface CellEditorProps {
  /** The cell's current value. */
  value: unknown;
  row: GridRow;
  column: ColumnDef;
  /** The key that started type-to-edit, or null when opened by double-click/Enter. */
  seed: string | null;
  /** Save `value` (validated, then emitted through onCellEdit) and close. */
  commit: (value: unknown) => void;
  /** Close without saving. */
  cancel: () => void;
}

/**
 * Discriminated column config — the public Phase 0 "columns + rows" surface,
 * extended with the Phase 1 sparkline + heatmap cell types.
 */
export type ColumnDef =
  | (ColBase & { type: 'text'; sub?: string })
  | (ColBase & { type: 'price' })
  | (ColBase & { type: 'percent' })
  | (ColBase & { type: 'volume' })
  | (ColBase & { type: 'number'; decimals?: number })
  | (ColBase & { type: 'date'; dateStyle?: DateStyle })
  | (ColBase & { type: 'currency'; currency?: string; decimals?: number })
  | (ColBase & { type: 'relative' }) // value: epoch ms → "3 hours ago"
  | (ColBase & { type: 'heatmap'; min: number; max: number; decimals?: number })
  | (ColBase & { type: 'sparkline'; sparkKey: string })
  // Rich cell types (any business domain) — value renders as the named widget.
  | (ColBase & { type: 'progress'; min?: number; max?: number })
  | (ColBase & { type: 'rating'; max?: number })
  | (ColBase & { type: 'tags' }) // value: string[] (or comma-separated string)
  | (ColBase & { type: 'badge'; tones?: Record<string, BadgeTone> })
  | (ColBase & { type: 'boolean'; trueLabel?: string; falseLabel?: string })
  | (ColBase & { type: 'avatar'; sub?: string }) // value: display name
  | (ColBase & { type: 'link'; href?: (row: GridRow) => string; newTab?: boolean }) // value: text
  // Rendered by the consumer's `cell` snippet on <Grid>.
  | (ColBase & { type: 'custom' })
  // A type registered through <Grid cellTypes>; resolved to a built-in type
  // (its `extends`) before the grid reads it. Extra keys are type options.
  | (ColBase & { type?: undefined; cellType: string; [option: string]: unknown });

/** Props a `component` cell renderer receives. */
export interface CellTypeProps {
  value: unknown;
  row: GridRow;
  column: ColumnDef;
  /** The value formatted the way copy, export and tooltips see it. */
  text: string;
}

/** Built-in column types a registered cell type can build on. */
export type BuiltinCellType = Exclude<ColumnDef['type'], undefined>;

/** A reusable column type for <Grid cellTypes>: defaults merged under each
    column that names it, plus an optional `component` to draw the cell.
    `extends` picks the built-in type whose formatting, sorting, filtering and
    alignment it inherits (default: `custom` when it draws itself, else `text`). */
export type CellTypeDef = Omit<Partial<ColBase>, 'key' | 'header'> & {
  extends?: BuiltinCellType;
  [option: string]: unknown;
};

/** Semantic colour for a `badge` value (mapped via the column's `tones`). */
export type BadgeTone = 'up' | 'down' | 'amber' | 'info' | 'neutral';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
}

/** Minimal row contract the grid relies on. Concrete rows add their own fields. */
export interface GridRow {
  id: number;
  /** Legacy row-driven flash counter — only needed for `flash: true` columns.
      Derived flash (`flash: 'auto' | 'change'`) requires neither field. */
  flashSeq?: number;
  flashDir?: 'up' | 'down';
  [field: string]: unknown;
}

/**
 * The cell's value: a column's computed `value(row)` when defined, else the row
 * field `row[key]`. Route ALL value reads through this so computed columns flow
 * through display, sort, filter, aggregation and export.
 */
export function cellValue(col: ColumnDef, row: GridRow): unknown {
  return col.value ? col.value(row) : row[col.key];
}

export function formatCell(col: ColumnDef, value: unknown, row?: GridRow): string {
  if (col.format) return col.format(value, row);
  const n = typeof value === 'number' ? value : Number(value);
  switch (col.type) {
    case 'price':
      return fmtPrice(n, col.locale);
    case 'percent':
      return fmtPercent(n);
    case 'volume':
      return fmtVolume(n);
    case 'number':
      return n.toFixed(col.decimals ?? 2);
    case 'date':
      return fmtDate(n, col.dateStyle, col.locale);
    case 'currency':
      return fmtCurrency(n, col.currency, col.locale, col.decimals);
    case 'relative':
      return relativeTime(n, undefined, col.locale);
    case 'heatmap':
      return n.toFixed(col.decimals ?? 2);
    case 'rating':
      return `${value ?? 0}`;
    case 'tags':
      return Array.isArray(value) ? value.join(', ') : String(value ?? '');
    case 'boolean':
      return value ? (col.trueLabel ?? 'Yes') : (col.falseLabel ?? 'No');
    default:
      // progress / badge / avatar / link / text and friends.
      return value == null ? '' : String(value);
  }
}

/**
 * Resolve a cell's tooltip text for the styled floating tooltip. A boolean
 * `tooltip` shows the formatted value (skipped for sparkline/custom — no text
 * form); a function returns custom text for any column type. Empty/whitespace →
 * no tooltip. Pure; unit-tested.
 */
export function tooltipText(col: ColumnDef, value: unknown, row: GridRow): string | undefined {
  const t = col.tooltip;
  if (!t) return undefined;
  const text =
    typeof t === 'function'
      ? t(value, row)
      : col.type === 'sparkline' || col.type === 'custom'
        ? ''
        : formatCell(col, value, row);
  return text && text.trim() ? text : undefined;
}

export function isSortable(col: ColumnDef): boolean {
  return col.type !== 'sparkline' && col.sortable !== false;
}

// Rich display widgets aren't text-editable (they render structured/visual data).
const DISPLAY_ONLY = ['sparkline', 'custom', 'tags', 'badge', 'boolean', 'avatar', 'progress', 'rating', 'link', 'relative'];

export function isEditable(col: ColumnDef): boolean {
  // Computed columns have no underlying field to write back to.
  if (!col.editable || col.value) return false;
  return !!col.editor || (!!col.type && !DISPLAY_ONLY.includes(col.type));
}

// One collator for every string comparison: `localeCompare` without a cached
// collator rebuilds locale data per call, which dominates a large sort.
const collate = new Intl.Collator().compare;

function rawCompare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collate(String(a ?? ''), String(b ?? ''));
}

/**
 * Sort rows by `sorts`, reading each row's sort value(s) exactly once and
 * sorting indices — n reads instead of ~2·n·log n. Matters when values come
 * through reactive proxies or computed columns, and when a live board re-sorts
 * every second. Stable; never mutates the input. Returns the input itself for
 * an empty sort list.
 */
export function sortRows<T extends GridRow>(
  rows: readonly T[],
  sorts: readonly SortState[],
  columns: readonly ColumnDef[],
): T[] {
  if (sorts.length === 0) return rows as T[];
  const n = rows.length;
  const specs = sorts.map((sort) => {
    const col = columns.find((c) => c.key === sort.key);
    const keys = new Array<unknown>(n);
    for (let i = 0; i < n; i++) keys[i] = col?.value ? col.value(rows[i]) : rows[i][sort.key];
    return { keys, dir: sort.dir === 'asc' ? 1 : -1, compare: col?.compare ?? rawCompare };
  });
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((i, j) => {
    for (const sp of specs) {
      const d = sp.compare(sp.keys[i], sp.keys[j]);
      if (d !== 0) return d * sp.dir;
    }
    return i - j;
  });
  return order.map((i) => rows[i]);
}

export function compareRows(a: GridRow, b: GridRow, sort: SortState, col?: ColumnDef): number {
  // Computed columns sort by their derived value; everything else reads the
  // authoritative sort key off the row.
  const av = col?.value ? col.value(a) : a[sort.key];
  const bv = col?.value ? col.value(b) : b[sort.key];
  const d = col?.compare ? col.compare(av, bv) : rawCompare(av, bv);
  return sort.dir === 'asc' ? d : -d;
}

/**
 * Multi-key comparison: apply each sort in order, returning the first that
 * separates the rows. An empty list leaves rows in their original order.
 */
export function compareBySorts(
  a: GridRow,
  b: GridRow,
  sorts: readonly SortState[],
  colOf?: (key: string) => ColumnDef | undefined,
): number {
  for (const sort of sorts) {
    const d = compareRows(a, b, sort, colOf?.(sort.key));
    if (d !== 0) return d;
  }
  return 0;
}

export function colStyle(col: ColumnDef): string {
  if (col.flex) return `flex:${col.flex} 1 0;min-width:${col.minWidth ?? 0}px;${col.maxWidth ? `max-width:${col.maxWidth}px;` : ''}`;
  return `flex:0 0 ${col.width ?? 96}px;`;
}

/** Narrowest a flex column without a `minWidth` gets before the grid scrolls
    horizontally instead of squeezing it further. */
export const MIN_FLEX_W = 64;

/** A column's starting width in fixed-width mode (pinned columns, column
    virtualization, or too little room): its `width`, and for a flex column
    without one its `minWidth` (64 without one). Flex columns then grow to fill
    the viewport, so they never start wider than they need to. */
export function baseWidth(col: ColumnDef): number {
  if (col.flex) return col.width ?? col.minWidth ?? MIN_FLEX_W;
  return col.width ?? 96;
}

export function isNumeric(col: ColumnDef): boolean {
  // Non-numeric (text-aligned / structured) types; everything else is a number.
  if (!col.type) return false;
  return !['text', 'sparkline', 'custom', 'tags', 'badge', 'boolean', 'avatar', 'link'].includes(col.type);
}

/** The side a column's header, cells and footer sit on: `align` when set,
    otherwise right for numbers and left for everything else. */
export function alignOf(col: ColumnDef): Align {
  return col.align ?? (isNumeric(col) ? 'right' : 'left');
}

export function candlesOf(row: GridRow, key: string): Candle[] {
  return (row[key] as Candle[]) ?? [];
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

// Coerce to a number, but treat null/undefined/'' as non-numeric (NaN) — guards
// against `Number(null) === 0` slipping blanks through as a real zero value.
function numericOrNaN(value: unknown): number {
  if (value === null || value === undefined || value === '') return NaN;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Conditional formatting — data-bar geometry. Maps `value` onto a 0..1 range,
 * anchored at the zero baseline so signed columns diverge left/right around zero
 * (left-anchored when the range doesn't cross zero). `range` is the data extent;
 * `cfg.min`/`cfg.max` override it (e.g. `min: 0` for absolute bars). Returns null
 * for non-numeric values (no bar). Pure; unit-tested.
 */
export function dataBarGeometry(
  value: unknown,
  range: { min: number; max: number },
  cfg: { min?: number; max?: number } = {},
): DataBarGeom | null {
  const n = numericOrNaN(value);
  if (!Number.isFinite(n)) return null;
  const min = cfg.min ?? range.min;
  const max = cfg.max ?? range.max;
  const span = max - min || 1;
  const zero = clamp01((0 - min) / span);
  const v = clamp01((n - min) / span);
  return { left: Math.min(zero, v), width: Math.abs(v - zero), negative: n < 0 };
}

// Default colour-scale stops — soft, translucent theme tints so row striping
// shows through and text stays readable (mixed in sRGB to keep clean alpha).
const SCALE_SEQ: [string, string] = ['transparent', 'color-mix(in srgb, var(--bo-up) 32%, transparent)'];
const SCALE_DIV: [string, string, string] = [
  'color-mix(in srgb, var(--bo-down) 34%, transparent)',
  'transparent',
  'color-mix(in srgb, var(--bo-up) 34%, transparent)',
];

const mixColor = (a: string, b: string, t: number): string =>
  `color-mix(in srgb, ${b} ${(clamp01(t) * 100).toFixed(1)}%, ${a})`;

/**
 * Conditional formatting — colour-scale background for a value across the range.
 * Two-stop (low→high) by default; pass `cfg.mid` (or 3 `colors`) for a diverging
 * scale. `range` is the data extent; `cfg.min`/`cfg.max` override it. Returns null
 * for non-numeric values (no tint). Pure; unit-tested.
 */
export function colorScaleBackground(
  value: unknown,
  range: { min: number; max: number },
  cfg: ColorScaleConfig = {},
): string | null {
  const n = numericOrNaN(value);
  if (!Number.isFinite(n)) return null;
  const min = cfg.min ?? range.min;
  const max = cfg.max ?? range.max;
  const span = max - min || 1;
  const t = clamp01((n - min) / span);
  if (cfg.mid != null || cfg.colors?.length === 3) {
    const [lo, md, hi] = (cfg.colors as [string, string, string]) ?? SCALE_DIV;
    const mt = clamp01(((cfg.mid ?? (min + max) / 2) - min) / span);
    return t <= mt
      ? mixColor(lo, md, mt === 0 ? 1 : t / mt)
      : mixColor(md, hi, mt === 1 ? 1 : (t - mt) / (1 - mt));
  }
  const [lo, hi] = (cfg.colors as [string, string]) ?? SCALE_SEQ;
  return mixColor(lo, hi, t);
}

/**
 * Conditional formatting — pick the icon-set rule for a value: the rule with the
 * greatest `at` threshold that is ≤ the value (order-independent). Returns null
 * for non-numeric values or when no threshold matches. Pure; unit-tested.
 */
export function pickIcon(value: unknown, rules: readonly IconRule[]): IconRule | null {
  const n = numericOrNaN(value);
  if (!Number.isFinite(n)) return null;
  let pick: IconRule | null = null;
  for (const rule of rules) {
    if (n >= rule.at && (pick === null || rule.at >= pick.at)) pick = rule;
  }
  return pick;
}

/** Sanitize a `link` column's href: block the XSS-prone url schemes
    (javascript:/data:/vbscript:), pass everything else (http(s)/mailto/tel/
    relative). Returns undefined for an empty or unsafe href (renders as text). */
export function safeHref(url: string): string | undefined {
  const u = url.trim();
  if (!u) return undefined;
  // eslint-disable-next-line no-script-url
  if (/^(javascript|data|vbscript):/i.test(u)) return undefined;
  return u;
}

/** Semantic tone → grid theme colour var (shared by badges + icon sets). */
export function toneColor(tone?: BadgeTone): string {
  switch (tone) {
    case 'up':
      return 'var(--bo-up)';
    case 'down':
      return 'var(--bo-down)';
    case 'amber':
      return 'var(--bo-amber)';
    case 'info':
      return 'var(--bo-sel-border)';
    default:
      return 'var(--bo-text-dim)';
  }
}
