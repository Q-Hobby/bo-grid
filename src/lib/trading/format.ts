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

/** Options for `fmtBps`. */
export interface BpsOptions {
  /** Decimal places; 1 by default. */
  decimals?: number;
  /** A `+` on a rise, for a change column. */
  sign?: boolean;
  /** After the number, with a space; `'bp'` by default, `''` for none (when
      the header already says bp). */
  unit?: string;
  locale?: string;
}

/** A fraction in basis points (1 bp = 0.01%): 0.00125 → `'12.5 bp'`. For a
    spread, pass `(ask - bid) / mid`; for a move in a yield quoted in percent,
    `(y1 - y0) / 100`. Empty for a value that is not a number. */
export function fmtBps(fraction: number, opts: BpsOptions = {}): string {
  if (!Number.isFinite(fraction)) return '';
  const d = Number.isInteger(opts.decimals) && opts.decimals! >= 0 && opts.decimals! <= 20 ? opts.decimals! : 1;
  const scale = 10 ** d;
  // Rounded here, on the magnitude so ties go the same way on both sides,
  // and so a tiny negative reads 0.0, not -0.0 (`|| 0` drops -0).
  const r = Math.round(Math.abs(fraction) * 10_000 * scale) / scale;
  const bps = (fraction < 0 ? -r : r) || 0;
  if (!Number.isFinite(bps)) return '';
  const signDisplay = opts.sign ? 'exceptZero' : 'auto';
  const text = numberFormat(opts.locale ?? 'en-US', `bps${d}${signDisplay}`, { minimumFractionDigits: d, maximumFractionDigits: d, signDisplay }).format(bps);
  const unit = opts.unit ?? 'bp';
  return unit ? `${text} ${unit}` : text;
}

/** How the last character of a fractional price is written. */
export type FractionStyle = 'cash' | 'futures';

/** Options for `fmtFraction` and `parseFraction`. */
export interface FractionOptions {
  /** Parts per whole: 32 (the default) for Treasury notes and bonds, 8 for
      grain futures, 64, 4 and so on. */
  denominator?: number;
  /** Splits each part further, shown as one last character: 2 for halves, 4
      for quarters, 8 for eighths. 1 (the default) rounds to whole parts. */
  sub?: 1 | 2 | 4 | 8;
  /** `'cash'` (the default) writes the last character in eighths of a part,
      with `+` for the half: quarters read `2`, `+`, `6`, as cash Treasuries
      are quoted. `'futures'` writes the first decimal digit of the part, as
      exchange screens quote Treasury futures: quarters read `2`, `5`, `7`,
      and a whole part ends in `0`. */
  style?: FractionStyle;
  /** Between the whole number and the parts: `'-'` by default, `"'"` for
      `'futures'`. `parseFraction` reads `-`, `'`, `’` and an en dash. */
  separator?: string;
}

const SUBS = [1, 2, 4, 8];
// The last character for 0 to 7 eighths of a part, per style.
const TAILS: Record<FractionStyle, string[]> = {
  cash: ['', '1', '2', '3', '+', '5', '6', '7'],
  futures: ['0', '1', '2', '3', '5', '6', '7', '8'],
};
const validDenominator = (d: number): boolean => Number.isInteger(d) && d >= 2 && d <= 1024;
const validStyle = (s: string): s is FractionStyle => s === 'cash' || s === 'futures';

/** A price as a whole number and parts, the way Treasuries are quoted:
    99.515625 → `'99-16+'` with `sub: 2` (99 and 16½ 32nds), or `"99'165"`
    with `sub: 4, style: 'futures'`. Rounds to the nearest step and carries
    (99.999 → `'100-00'`); keeps the sign of a negative price. Empty for a
    price that is not a number (or too large to count in steps exactly) and
    for options it cannot use. */
export function fmtFraction(price: number, opts: FractionOptions = {}): string {
  const denominator = opts.denominator ?? 32;
  const sub = opts.sub ?? 1;
  const style = opts.style ?? 'cash';
  if (!validDenominator(denominator) || !SUBS.includes(sub) || !validStyle(style)) return '';
  const steps = denominator * sub;
  // Past the safe integers the steps no longer count exactly.
  if (!(Math.abs(price) * steps < Number.MAX_SAFE_INTEGER)) return '';
  const total = Math.round(Math.abs(price) * steps);
  const whole = Math.floor(total / steps);
  const rest = total - whole * steps;
  const part = Math.floor(rest / sub);
  const tail = sub === 1 ? '' : TAILS[style][(rest - part * sub) * (8 / sub)];
  const width = String(denominator - 1).length;
  const separator = opts.separator ?? (style === 'futures' ? "'" : '-');
  return `${total > 0 && price < 0 ? '-' : ''}${whole}${separator}${String(part).padStart(width, '0')}${tail}`;
}

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/;
// After - and ', the separators include a typographic apostrophe and an en
// dash, for a price pasted from a document.
const FRACTION = /^([+-]?)(\d+)[-'’–](\d+)(\+?)$/;

/** The eighths a last character stands for in `style`, or -1. A cash price
    also takes `0` and `4`. */
function eighthsOf(c: string, style: FractionStyle): number {
  const i = TAILS[style].indexOf(c);
  if (i >= 0) return i;
  return style === 'cash' && (c === '0' || c === '4') ? Number(c) : -1;
}

/** Reads a price written as `fmtFraction` writes it (`'99-16+'`, `'99-162'`,
    `"450'2"` with a denominator of 8), or as a plain decimal, for a column's
    `parse`; pass the same options the column formats with (`sub` and
    `separator` only shape the output, so reading ignores them).
    The parts take as many digits as the denominator needs, so with a
    denominator of 8, `'99-12'` is 99 and 1¼ eighths. One more character
    counts part of a part, in the style's notation (`+` is a half in
    either). NaN for anything else, which refuses the edit. */
export function parseFraction(text: string, opts: FractionOptions = {}): number {
  const s = text.trim();
  const denominator = opts.denominator ?? 32;
  const style = opts.style ?? 'cash';
  if (!validDenominator(denominator) || !validStyle(style)) return Number.NaN;
  if (DECIMAL.test(s)) return Number(s) || 0;
  const m = FRACTION.exec(s);
  if (!m) return Number.NaN;
  const width = String(denominator - 1).length;
  const digits = m[3];
  if (digits.length > width + 1 || (digits.length > width && m[4])) return Number.NaN;
  const part = Number(digits.slice(0, width));
  const eighths = m[4] ? 4 : digits.length > width ? eighthsOf(digits[width], style) : 0;
  if (part >= denominator || eighths < 0) return Number.NaN;
  const value = Number(m[2]) + (part + eighths / 8) / denominator;
  return (m[1] === '-' ? -value : value) || 0;
}
