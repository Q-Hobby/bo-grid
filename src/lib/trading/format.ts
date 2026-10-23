// Tick-aware price formatting.
//
// bo-grid's built-in `price` column type is a fixed 2 decimals (fmtPrice) —
// right for USD-style quotes, wrong for a whole-VND stock (0 decimals) or an
// FX pair (4). The right decimal count is a property of the instrument's tick
// size, not a per-column constant — these read it off the tick instead.
import { numberFormat } from '../format/intl';

// Precision ceiling for the fixed-notation normalization below. Realistic
// instrument ticks (down to an 8-decimal crypto pip) fit comfortably inside
// this; there is no real-world tick this would misreport.
const MAX_DECIMALS = 10;

/** How many decimal places a tick size implies — 10 → 0, 0.01 → 2, 0.0001 → 4.
    Works off a fixed-notation string rather than floating-point log math (so a
    tick like `0.1`, imprecise in IEEE-754, doesn't misreport a decimal count)
    and rather than `tick.toString()` directly (which switches to exponential
    notation below ~1e-6, e.g. `(0.0000001).toString() === '1e-7'` — a plain
    string-split on "." would then silently report 0). */
export function decimalsForTick(tick: number): number {
  if (!Number.isFinite(tick) || tick <= 0 || tick >= 1e21) return 0;
  const s = tick.toFixed(MAX_DECIMALS).replace(/0+$/, '').replace(/\.$/, '');
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Format a price at the precision its tick size implies, with thousands
    separators. `tick` is typically `vnTickSize(value, exchange)` or a fixed
    instrument tick (e.g. `0.0001` for a 4-decimal FX pair). */
export function fmtTradingPrice(value: number, tick: number, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '';
  const decimals = decimalsForTick(tick);
  return numberFormat(locale, `tick${decimals}`, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
