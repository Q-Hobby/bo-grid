// Built-in formatters (proposal Phase 1 §Ticker column + formatting).
import { dateFormat, numberFormat, relativeFormat } from './intl';

const PRICE: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export function fmtPrice(v: number, locale = 'en-US'): string {
  // A non-number (from untyped JS) keeps its own toLocaleString, as before.
  if (typeof v === 'number') return numberFormat(locale, 'price', PRICE).format(v);
  return (v as { toLocaleString(...args: unknown[]): string }).toLocaleString(locale, PRICE);
}

export function fmtPercent(v: number): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

// [size, suffix, decimals], smallest first.
const VOLUME_UNITS: [number, string, number][] = [
  [1e3, 'K', 1],
  [1e6, 'M', 2],
  [1e9, 'B', 2],
  [1e12, 'T', 2],
];

export function fmtVolume(v: number): string {
  if (!Number.isFinite(v)) return `${v}`;
  const abs = Math.abs(v);
  let unit = -1;
  while (unit + 1 < VOLUME_UNITS.length && abs >= VOLUME_UNITS[unit + 1][0]) unit++;
  if (unit < 0) return `${v}`;
  let [size, suffix, decimals] = VOLUME_UNITS[unit];
  let text = (abs / size).toFixed(decimals);
  // 999,999 rounds to 1000.0K: show it as 1.00M instead.
  if (Number(text) >= 1000 && unit + 1 < VOLUME_UNITS.length) {
    [size, suffix, decimals] = VOLUME_UNITS[unit + 1];
    text = (abs / size).toFixed(decimals);
  }
  return `${v < 0 ? '-' : ''}${text}${suffix}`;
}

export type DateStyle = 'short' | 'medium';

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { month: 'numeric', day: 'numeric', year: '2-digit' },
  medium: { month: 'short', day: 'numeric', year: 'numeric' },
};

export function fmtDate(ms: number, style: DateStyle = 'medium', locale = 'en-US'): string {
  if (!Number.isFinite(ms)) return '';
  const s = style === 'short' ? 'short' : 'medium';
  return dateFormat(locale, s, DATE_STYLES[s]).format(new Date(ms));
}

/** Localized currency (e.g. `$1,234.50`). Falls back to a fixed-decimal number
    if the ISO `currency` code is unsupported. */
export function fmtCurrency(v: number, currency = 'USD', locale = 'en-US', decimals?: number): string {
  if (!Number.isFinite(v)) return '';
  const fd = decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {};
  try {
    return numberFormat(locale, `cur${currency}|${decimals ?? ''}`, { style: 'currency', currency, ...fd }).format(v);
  } catch {
    return v.toFixed(decimals ?? 2);
  }
}

// Coarse relative-time thresholds (seconds → unit divisor + label).
const RT: [number, number, string][] = [
  [3600, 60, 'min'],
  [86_400, 3600, 'hour'],
  [604_800, 86_400, 'day'],
  [2_629_800, 604_800, 'week'],
  [31_557_600, 2_629_800, 'month'],
  [Infinity, 31_557_600, 'year'],
];

const RT_UNITS: [number, number, Intl.RelativeTimeFormatUnit][] = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86_400, 3600, 'hour'],
  [604_800, 86_400, 'day'],
  [2_629_800, 604_800, 'week'],
  [31_557_600, 2_629_800, 'month'],
  [Infinity, 31_557_600, 'year'],
];

function intlRelative(secsAgo: number, locale: string): string {
  const a = Math.abs(secsAgo);
  const sign = secsAgo >= 0 ? -1 : 1;
  const fmt = relativeFormat(locale);
  for (const [ceil, div, unit] of RT_UNITS) {
    if (a < ceil) return fmt.format(sign * Math.floor(a / div), unit);
  }
  return '';
}

/** Human relative time vs `now` (default: real now) — e.g. `3 hours ago`,
    `in 2 days`. `ms` is an epoch timestamp. Deterministic when `now` is passed. With a `locale`, output comes from
    `Intl.RelativeTimeFormat`. */
export function relativeTime(ms: number, now = Date.now(), locale?: string): string {
  if (!Number.isFinite(ms)) return '';
  const secs = Math.round((now - ms) / 1000); // >0 = past
  if (locale) return intlRelative(secs, locale);
  const past = secs >= 0;
  const a = Math.abs(secs);
  if (a < 45) return past ? 'just now' : 'soon';
  for (const [ceil, div, unit] of RT) {
    if (a < ceil) {
      const n = Math.floor(a / div);
      const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
      return past ? `${label} ago` : `in ${label}`;
    }
  }
  return '';
}
