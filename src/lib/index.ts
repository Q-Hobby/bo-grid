// Public API for the bo-grid package.
// Consumers: `import { Grid, type ColumnDef } from 'bo-grid';`
//
// This surface is intentionally small — every export is a compatibility promise.
// Internal helpers (layout, sorting, grouping, selection internals) are NOT
// exported; they can change freely between versions.

// Components
import type { ComponentProps } from 'svelte';
import type GridComponent from './grid/Grid.svelte';
export { default as Grid } from './grid/Grid.svelte';
export { default as Sparkline } from './sparkline/Sparkline.svelte';

/** Every `<Grid>` prop, as one object type. Use it to type a config object —
    especially the `<bo-grid>` web component's `config` (see `bo-grid/element`). */
export type GridProps = ComponentProps<typeof GridComponent>;

// Server-side (lazy) grouping summary type (for the `lazyGroups` prop)
export type { LazyGroup } from './grid/grouping';

// Column + grid configuration types
export type {
  ColumnDef,
  Align,
  GridRow,
  SortDir,
  SortState,
  CellEditEvent,
  CellRenderContext,
  BadgeTone,
  DataBarConfig,
  IconRule,
  ColorScaleConfig,
  CellTypeDef,
  CellTypeProps,
  CellEditorProps,
  BuiltinCellType,
  ShowChangeOptions,
} from './grid/column';
export { resolveColumns } from './grid/celltype';
export { sortRows } from './grid/column';
export type { DefaultColumn } from './grid/celltype';
export type { Hotkeys, HotkeyHandler, HotkeyContext } from './grid/hotkeys';
export type { AggKind, AggResult } from './grid/aggregate';

// Column filter model (for controlled filtering via `columnFilters`/`onFilterChange`)
export type {
  ColumnFilter,
  FilterKind,
  TextOp,
  NumberOp,
  DateOp,
  AnyFilter,
  CustomFilter,
  FilterEditorProps,
  FilterTypeDef,
  FilterTypes,
} from './grid/filtering';

// Value formatters (handy when building custom cell content)
export { fmtPrice, fmtPercent, fmtVolume, fmtDate, fmtCurrency, relativeTime } from './format/format';
export type { DateStyle } from './format/format';

// Standalone helpers
export { aggregate } from './grid/aggregate';
export { heatColor } from './grid/heatmap';
export { pivot } from './grid/pivot';
export type { PivotConfig, PivotResult } from './grid/pivot';

// Theming
export {
  themeVars,
  darkTheme,
  lightTheme,
  highContrastDark,
  highContrastLight,
  midnightTheme,
  terminalTheme,
  tradecanvasTheme,
  tradecanvasLightTheme,
  themePresets,
} from './grid/theme';
export type { GridTheme, ThemePreset } from './grid/theme';
export { DEFAULT_LABELS, resolveLabels } from './grid/labels';
export { reconcileState, GRID_STATE_VERSION } from './grid/state';
export { buildMergePlan, colSpanRow } from './grid/merge';
export type { MergePlan, MergeInput, SpanRun } from './grid/merge';
export type { GridState } from './grid/state';
export type { GridApi, ScrollAlign, ViewportRange, FlashCellsOptions } from './grid/api';
export type { GridLabels } from './grid/labels';

// Sparkline canvas primitives (draw candlesticks on your own canvas)
export { drawCandles, setupHiDpiCanvas } from './sparkline/sparkline-render';

// Export + import (CSV is dependency-free; XLSX dynamic-imports the optional `xlsx` peer)
export {
  toCSV,
  exportCSV,
  parseCSV,
  parseCSVMatrix,
  parseTSV,
  parseJSON,
  parseRows,
  rowsFromObjects,
} from './grid/export';
export { exportXLSX } from './grid/export-xlsx';
export type { ExportOptions } from './grid/export';

// Printable / export HTML (renders ALL rows, unlike the virtualized grid)
export { toHTMLTable, printTable, escapeHTML } from './grid/print';

// Server-side / windowed data source
export { createArraySource } from './grid/source';
export type {
  RowSource,
  RowRange,
  RowSourceParams,
  RowSourceResult,
  ArraySourceOptions,
} from './grid/source';

// Shared types
export type { Candle } from './types';
// Errors bo-grid throws carry a stable `code` (BG1001…), the fix and a docs link.
export type { BoGridError, BoGridErrorCode } from './errors';
