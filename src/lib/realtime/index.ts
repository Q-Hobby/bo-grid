// Public API for `bo-grid/realtime` — everything between a market-data feed
// and the grid: coalesced price updates, a feed decoded in a worker and
// applied a batch a frame, an order book kept from a depth feed, a capped trade tape, rows that stay a moment after they leave a list,
// alerts that stay lit until acknowledged, and the windowing math for a
// centered/scroll-locked price ladder.
//
// A separate entry: it adds nothing to the grid core unless you import it,
// and it keeps its own size budget.
export {
  TickBuffer,
  createTickStream,
  createRowIndex,
  applyPatches,
  DEFAULT_CAP,
} from './ticks';
export type {
  TickStream,
  TickStreamOptions,
  TickBufferOptions,
  Scheduler,
  Cancel,
} from './ticks';

export { serveFeed, connectFeed } from './worker-feed';
export type { FeedSource, WorkerFeed, ServeFeedOptions, ConnectFeedOptions, FeedWorker, FeedScope } from './worker-feed';

export { createOrderBook } from './book';
export type { OrderBook, OrderBookOptions, OrderBookUpdate, BookUpdateResult, BookReadOptions, BookTop, BookRow, BookPairRow, BookLevel, BookLevelInput } from './book';

export { TradeTape } from './tape';

export { createViewportSubscriptions, DEFAULT_VIEWPORT_DELAY } from './viewport';
export type { ViewportSubscriptions, ViewportSubscriptionsOptions } from './viewport';

export { createLinger } from './linger';
export type { Linger, LingerOptions } from './linger';

export { createAlerts } from './alerts';
export type { Alerts, AlertsOptions, Alert, CheckOptions } from './alerts';

export { centeredWindow } from './ladder';
export type { LadderWindow } from './ladder';

// The errors this entry throws carry a stable `code` (BG2001…), the fix and a docs link.
export type { BoGridError, BoGridErrorCode } from '../errors';
