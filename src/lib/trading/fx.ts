// FX conventions: pip sizes, the way a dealing screen shows a quote (the big
// figure small, the pips large, the pipette raised), moves in pips, and the
// FX week with its trading centres.
import { decimalsForTick } from './format';
import { wallClock } from './session';

/** A pair (`'EUR/USD'`, `'USDJPY'`, `'usd_jpy'`) or a pip size. */
export type PipOf = string | number;

/** A pair's pip: 0.01 when the quote currency is the yen, 0.0001 otherwise.
    The pair is read from its first six letters, so a broker's suffix
    (`'USDJPY.m'`) does not change it. Pass a pip size wherever a pair is
    taken for anything else: metals, currencies with another pip (HUF, KRW),
    a broker's own convention. */
export function fxPipSize(pair: string): number {
  const m = /^([A-Z]{3})[^A-Z]?([A-Z]{3})/.exec(pair.toUpperCase().trim());
  const quote = m ? m[2] : pair.toUpperCase().replace(/[^A-Z]/g, '').slice(-3);
  return quote === 'JPY' ? 0.01 : 0.0001;
}

const pipOf = (p: PipOf): number => (typeof p === 'number' ? p : fxPipSize(p));

/** A quote cut the way a dealing screen shows it. */
export interface FxQuoteParts {
  /** Everything before the pips: `'1.08'` of 1.08452. */
  big: string;
  /** The two pip digits: `'45'`. */
  pips: string;
  /** The fractional pip: `'2'`; empty without one. */
  pipette: string;
}

/** `price` cut into big figure, pips and pipette for its pair (or a pip size
    below 1). `pipette: false` stops at the pip. Empty parts for a price that
    is not a number (or is 1e21 or more) and for a pip size that is not
    between 0 and 1. */
export function fxQuoteParts(price: number, pip: PipOf, opts: { pipette?: boolean } = {}): FxQuoteParts {
  const size = pipOf(pip);
  if (!Number.isFinite(price) || Math.abs(price) >= 1e21 || !(size > 0 && size < 1)) return { big: '', pips: '', pipette: '' };
  const withPipette = opts.pipette ?? true;
  const d = decimalsForTick(size);
  const text = price.toFixed(withPipette ? d + 1 : d);
  const rest = withPipette ? text.slice(0, -1) : text;
  return { big: rest.slice(0, -2), pips: rest.slice(-2), pipette: withPipette ? text.slice(-1) : '' };
}

/** The quote as HTML for a column's `render`: the big figure dimmed, the
    pips large, the pipette raised, each in a class of its own
    (`bo-fx-big`, `bo-fx-pips`, `bo-fx-pipette`) with inline defaults. The
    text is digits and a point only, so it is safe as HTML. */
export function fxQuoteHtml(price: number, pip: PipOf, opts: { pipette?: boolean } = {}): string {
  const q = fxQuoteParts(price, pip, opts);
  if (!q.pips) return '';
  const pipette = q.pipette ? `<sup class="bo-fx-pipette" style="font-size:.72em;margin-left:1px">${q.pipette}</sup>` : '';
  return `<span class="bo-fx"><span class="bo-fx-big" style="opacity:.7">${q.big}</span><span class="bo-fx-pips" style="font-size:1.3em;font-weight:700">${q.pips}</span>${pipette}</span>`;
}

/** `a - b` in pips of the pair (or pip size), to a tenth of a pip: a spread
    (`pipsBetween(ask, bid, pair)`) or a move. */
export function pipsBetween(a: number, b: number, pip: PipOf): number {
  return Math.round(((a - b) / pipOf(pip)) * 10) / 10;
}

/** The FX week: open from Sunday 17:00 to Friday 17:00, New York time. */
export function fxMarketOpen(date: Date): boolean {
  const { hhmm, weekday } = wallClock(date, 'America/New_York');
  if (weekday === 'Sat') return false;
  if (weekday === 'Sun') return hhmm >= '17:00';
  if (weekday === 'Fri') return hhmm < '17:00';
  return true;
}

/** A trading centre of the FX day. */
export type FxCentre = 'Sydney' | 'Tokyo' | 'London' | 'New York';

/** Each centre's business hours in its own time zone (summer time follows). */
const CENTRES: { name: FxCentre; timeZone: string; open: string; close: string }[] = [
  { name: 'Sydney', timeZone: 'Australia/Sydney', open: '07:00', close: '16:00' },
  { name: 'Tokyo', timeZone: 'Asia/Tokyo', open: '09:00', close: '18:00' },
  { name: 'London', timeZone: 'Europe/London', open: '08:00', close: '17:00' },
  { name: 'New York', timeZone: 'America/New_York', open: '08:00', close: '17:00' },
];

/** The centres in business hours at `date` (on a weekday there, while the FX
    week is open), in the order the day passes through them. Two at once is
    an overlap, when the market is busiest. Sydney's Monday can begin before
    the week opens in New York; it counts from the open. */
export function fxCentresOpen(date: Date): FxCentre[] {
  if (!fxMarketOpen(date)) return [];
  return CENTRES.filter((c) => {
    const { hhmm, weekday } = wallClock(date, c.timeZone);
    return weekday !== 'Sat' && weekday !== 'Sun' && hhmm >= c.open && hhmm < c.close;
  }).map((c) => c.name);
}
