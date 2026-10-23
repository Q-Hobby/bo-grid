// Crypto conventions: a market that never closes, and prices that run from
// tens of thousands down to millionths in one watchlist, where a fixed
// decimal count suits no row.
import { numberFormat } from '../format/intl';
import type { SessionWindow } from './session';

/** Round the clock, every day: pass with `{ timeZone: 'UTC', skipWeekends:
    false }` to `sessionStateAt`, which then reads `'continuous'` always. */
export const CRYPTO_SCHEDULE: SessionWindow[] = [{ start: '00:00', end: '24:00', state: 'continuous' }];

/** A price to `digits` significant digits (default 5): 63,250 and 0.000012345
    both read at a glance in one column. Where you know the symbol's tick,
    `fmtTradingPrice(price, tick)` shows it exactly instead. Empty for a price
    that is not a number. */
export function fmtSigPrice(value: number, digits = 5, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '';
  const d = Number.isFinite(digits) ? Math.min(21, Math.max(1, Math.round(digits))) : 5;
  value = value || 0; // -0 shows as 0
  // At or above 10^digits the integer part is shown whole: significant
  // digits alone would print 1,234,567 as 1,234,600.
  const opts: Intl.NumberFormatOptions =
    Math.abs(value) >= 10 ** d ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: d };
  return numberFormat(locale, `sig${d}${Math.abs(value) >= 10 ** d ? 'i' : ''}`, opts).format(value);
}
