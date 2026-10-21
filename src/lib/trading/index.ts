// Public API for `bo-grid/trading` — market-convention helpers for APAC
// trading screens: price-limit tone (ceiling/floor/reference colouring),
// tick-aware price formatting, and session state.
//
// A separate entry, like `bo-grid/realtime`: pure
// functions only, no Grid/Cell changes, so it adds nothing to the grid core
// unless imported, and none of this is baked into `ColumnDef` — wire it up via
// the existing `render`/`cell`/`cellClass`/`format` hooks (see the README).
export { vnTickSize, roundToTick, vnBandPercent, vnBands, vnFuturesBands, VN_FUTURES_TICK, VN_FUTURES_BAND } from './bands';
export type { Exchange, ToneBands } from './bands';

export { resolveTone, toneColor, defaultToneColors, darkToneColors, lightToneColors } from './tone';
export type { Tone, ToneColors } from './tone';

export { decimalsForTick, fmtTradingPrice } from './format';

export { sessionStateAt, sessionLabel, VN_HOSE_SCHEDULE } from './session';
export type { SessionState, SessionWindow, SessionOptions } from './session';
