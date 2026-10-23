import type { Component } from 'svelte';
import TradingDesk from './TradingDesk.svelte';

export interface Example {
  id: string;
  title: string;
  /** Shown next to the logo when the example is active. */
  blurb: string;
  /** Eagerly bundled component (the default tab). */
  component?: Component;
  /** Lazy chunk, imported on first activation — keeps the entry bundle lean so
      the gallery can grow without inflating the core demo download. */
  load?: () => Promise<{ default: Component }>;  /** The example's file in src/demo/examples (no extension), for its Code view. */
  file: string;
}

// Only the default example ships in the entry chunk; the rest are code-split and
// fetched on demand. CSS is merged into one file (build.cssCodeSplit: false) so
// the lazy JS chunks have no stylesheet to preload.
export const EXAMPLES: Example[] = [
  {
    id: 'trading',
    title: 'Trading desk',
    blurb: 'Sparklines, realtime flash & heatmaps over 1,000 virtualized rows.',
    component: TradingDesk,
    file: 'TradingDesk',
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    blurb: 'Positions grouped by sector with live subtotals, P&L heatmap & pivot.',
    load: () => import('./Portfolio.svelte'),
    file: 'Portfolio',
  },
  {
    id: 'sheet',
    title: 'Spreadsheet',
    blurb: 'A general-purpose editable grid — inline edit, copy/paste, resize.',
    load: () => import('./Sheet.svelte'),
    file: 'Sheet',
  },
  {
    id: 'orderbook',
    title: 'Order book',
    blurb: 'A live depth ladder — per-row colour, depth bars, realtime size flashes.',
    load: () => import('./OrderBook.svelte'),
    file: 'OrderBook',
  },
  {
    id: 'priceboard',
    title: 'Price board',
    blurb: 'A full VN-style bảng giá under a busy-market feed — 1,000+ symbols, every changed cell flashing. Benchmarks itself.',
    load: () => import('./PriceBoard.svelte'),
    file: 'PriceBoard',
  },
  {
    id: 'liveblotter',
    title: 'Live blotter',
    blurb: '100,000 orders newest first: fills stream in, orders arrive and leave, live totals. Benchmarks itself.',
    load: () => import('./LiveBlotter.svelte'),
    file: 'LiveBlotter',
  },
  {
    id: 'blotter',
    title: 'Blotter',
    blurb: 'Execution blotter with merged cells — spanRows down repeated fills, colSpan for note rows.',
    load: () => import('./Blotter.svelte'),
    file: 'Blotter',
  },
  {
    id: 'ladder',
    title: 'Price ladder',
    blurb: '120 levels, 16 visible — centred on the spread with manual page + recenter (bo-grid/realtime centeredWindow).',
    load: () => import('./PriceLadder.svelte'),
    file: 'PriceLadder',
  },
  {
    id: 'timesales',
    title: 'Time & sales',
    blurb: 'A capped trade tape, newest first, O(1) per trade — bo-grid/realtime TradeTape.',
    load: () => import('./TimeSales.svelte'),
    file: 'TimeSales',
  },
  {
    id: 'vnboard',
    title: 'VN board',
    blurb: 'HOSE-style price-limit colouring (ceiling/floor/reference), tick-aware VND formatting & live session badge — bo-grid/trading.',
    load: () => import('./VnBoard.svelte'),
    file: 'VnBoard',
  },
  {
    id: 'correlation',
    title: 'Correlation',
    blurb: 'An N×N heatmap matrix with a pinned label column and dynamic columns.',
    load: () => import('./Correlation.svelte'),
    file: 'Correlation',
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    blurb: 'Rank medals and score bars (custom cells), podium row highlighting.',
    load: () => import('./Leaderboard.svelte'),
    file: 'Leaderboard',
  },
  {
    id: 'team',
    title: 'Team',
    blurb: 'A people/CRM board — rich cell types, plus styled hover tooltips, ellipsis truncation and a cell-selection toggle.',
    load: () => import('./Team.svelte'),
    file: 'Team',
  },
  {
    id: 'wide',
    title: 'Wide',
    blurb: '60+ columns with horizontal column virtualization and a pinned label column.',
    load: () => import('./WideGrid.svelte'),
    file: 'WideGrid',
  },
  {
    id: 'themes',
    title: 'Themes',
    blurb: 'Built-in theme presets — dark, light, high-contrast, midnight, terminal.',
    load: () => import('./Themes.svelte'),
    file: 'Themes',
  },
  {
    id: 'csv',
    title: 'CSV import',
    blurb: 'Round-trip CSV — parse text into rows (parseCSV) and export rows back (toCSV).',
    load: () => import('./CsvIO.svelte'),
    file: 'CsvIO',
  },
  {
    id: 'print',
    title: 'Print',
    blurb: 'Print or export ALL rows as a clean HTML table (toHTMLTable / printTable).',
    load: () => import('./PrintView.svelte'),
    file: 'PrintView',
  },
  {
    id: 'tree',
    title: 'Tree',
    blurb: 'A file-explorer tree — expandable folders, indented rows (tree data).',
    load: () => import('./Tree.svelte'),
    file: 'Tree',
  },
  {
    id: 'lazytree',
    title: 'Lazy tree',
    blurb: 'A server-backed tree — children load on expand (async) with a loading row.',
    load: () => import('./LazyTree.svelte'),
    file: 'LazyTree',
  },
  {
    id: 'servergroups',
    title: 'Server groups',
    blurb: 'Server-side grouping — group totals up front, rows load on expand.',
    load: () => import('./ServerGroups.svelte'),
    file: 'ServerGroups',
  },
  {
    id: 'tasks',
    title: 'Tasks',
    blurb: 'A drag-to-reorder task list (row reordering via a handle).',
    load: () => import('./Tasks.svelte'),
    file: 'Tasks',
  },
  {
    id: 'bigdata',
    title: '1M rows',
    blurb: 'A million-row trade tape, windowed from a synthetic source on demand.',
    load: () => import('./BigData.svelte'),
    file: 'BigData',
  },
];
