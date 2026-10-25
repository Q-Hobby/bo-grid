// The names the docs' examples use without declaring them, with their types:
// the app around an example (its rows, its order ticket, its socket). When
// scripts/docs-code.mjs writes an example out for svelte-check, it declares
// the ones the example uses, typed as here, so an example that misuses one
// fails `pnpm site:check`. Add a name when a new example needs one; keep the
// types the ones an app would really have.
import type { Component } from 'svelte';
import type {
  AnyFilter,
  CellEditorProps,
  CellTypeProps,
  ColumnDef,
  CustomFilter,
  FilterEditorProps,
  FilterTypeDef,
  GridApi,
  GridRow,
  LazyGroup,
  RowSourceResult,
  SortState,
} from 'bo-grid';
import type { Alerts, BookLevel, OrderBook, ViewportSubscriptions } from 'bo-grid/realtime';

/** A quote row on a price board. */
export interface Quote extends GridRow {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  change: number;
  volume: number;
  alertAbove?: number;
  alertBelow?: number;
}

/** A trade on a time & sales tape, shown as a grid row. */
export interface Trade extends GridRow {
  time: number;
  price: number;
  qty: number;
  side: 'buy' | 'sell';
}

/** A fill reported by the venue. */
export interface Fill {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
}

/** The custom filter the custom-filters page builds. */
export interface MoveFilter extends CustomFilter {
  kind: 'move';
  moves: ('down' | 'flat' | 'up')[];
}

export interface Free {
  // The grid and its data
  rows: GridRow[];
  columns: ColumnDef[];
  api: GridApi;
  row: GridRow;
  order: GridRow;
  roots: GridRow[];
  initialRows: GridRow[];
  initialQuotes: Quote[];
  quotes: Quote[];
  allRows: GridRow[];
  nextRows: GridRow[];
  orders: GridRow[];
  shown: GridRow[];
  benchmark: GridRow;
  levels: GridRow[];
  trades: Trade[];
  lazyGroups: LazyGroup[];
  data: { rows: GridRow[]; groups: LazyGroup[] };
  // State an example binds to the grid
  selectedRowId: string | number | null;
  openId: string | number | null;
  active: GridRow | undefined;
  selected: (string | number)[];
  sort: SortState[];
  columnFilters: Record<string, AnyFilter>;
  pageSize: number;
  page: number;
  showVolume: boolean;
  columnOrder: string[];
  version: number;
  // Values from the app
  id: string | number;
  ids: (string | number)[];
  fill: Fill;
  index: number;
  price: number;
  next: number;
  bid: number;
  ask: number;
  ticket: { qty: number };
  FEED_URL: string;
  RANK: Record<string, number>;
  // The market connection
  socket: WebSocket;
  book: OrderBook;
  snap: { lastUpdateId: number; bids: BookLevel[]; asks: BookLevel[] };
  bids: BookLevel[];
  asks: BookLevel[];
  alerts: Alerts<Quote, string>;
  subs: ViewportSubscriptions<string>;
  venue: { place(order: { side: 'buy' | 'sell'; price: number; qty: number }): void; cancel(ids: (string | number)[]): void };
  apply: (batch: Array<readonly [string, Partial<Quote>]>) => void;
  // App actions an example calls
  save: (...values: unknown[]) => void;
  buy: (row: GridRow) => void;
  cancel: (row: GridRow) => void;
  cancelAll: () => void;
  openTicket: (row: GridRow, side?: 'buy' | 'sell') => void;
  openSearch: () => void;
  openChart: (symbol: unknown) => void;
  open: (row: GridRow) => void;
  rowClass: (row: GridRow) => string | undefined;
  remove: (id: string | number) => void;
  copy: (text: string) => void;
  chime: (symbol: string, rule: string) => void;
  showQtyHint: () => void;
  resnapshot: () => void;
  sameDay: (a: unknown, b: unknown) => boolean;
  loadExchange: (key: string) => Promise<GridRow[]>;
  loadChildren: (row: GridRow) => Promise<GridRow[]>;
  fetchPage: (start: number, end: number, sorts: SortState[] | undefined, filter: string) => Promise<RowSourceResult>;
  // The app's own components and filters
  MiniChart: Component<{ sym: unknown }>;
  CountryCell: Component<CellTypeProps>;
  StarPicker: Component<CellEditorProps>;
  BandFilter: Component<FilterEditorProps<any>>;
  MoveEditor: Component<FilterEditorProps<MoveFilter>>;
  move: FilterTypeDef<MoveFilter>;
}
