import { describe, it, expect } from 'vitest';
import { fmtPrice, fmtPercent, fmtVolume, fmtDate, fmtCurrency, relativeTime } from './format';

describe('fmtPrice', () => {
  it('always shows two fraction digits with thousands separators', () => {
    expect(fmtPrice(1234.5)).toBe('1,234.50');
    expect(fmtPrice(0)).toBe('0.00');
    expect(fmtPrice(1_000_000)).toBe('1,000,000.00');
  });

  it('rounds to two decimals and keeps the sign', () => {
    expect(fmtPrice(9.999)).toBe('10.00');
    expect(fmtPrice(-1234.5)).toBe('-1,234.50');
  });
});

describe('fmtPercent', () => {
  it('prefixes a + only for positive values', () => {
    expect(fmtPercent(1.5)).toBe('+1.50%');
    expect(fmtPercent(0)).toBe('0.00%');
    expect(fmtPercent(-2.345)).toBe('-2.35%');
  });
});

describe('fmtVolume', () => {
  it('passes through values below 1,000', () => {
    expect(fmtVolume(0)).toBe('0');
    expect(fmtVolume(999)).toBe('999');
  });

  it('abbreviates K / M / B at the right thresholds', () => {
    expect(fmtVolume(1_000)).toBe('1.0K');
    expect(fmtVolume(1_500)).toBe('1.5K');
    expect(fmtVolume(1_000_000)).toBe('1.00M');
    expect(fmtVolume(2_500_000)).toBe('2.50M');
    expect(fmtVolume(1_000_000_000)).toBe('1.00B');
    expect(fmtVolume(1_000_000_000_000)).toBe('1.00T');
    expect(fmtVolume(25_000_000_000_000)).toBe('25.00T');
  });

  it('moves up a unit when rounding would show 1000 of the one below', () => {
    expect(fmtVolume(999_949)).toBe('999.9K');
    expect(fmtVolume(999_950)).toBe('1.00M');
    expect(fmtVolume(999_999)).toBe('1.00M');
    expect(fmtVolume(999_995_000)).toBe('1.00B');
  });

  it('abbreviates a negative volume (a net flow) the same way', () => {
    expect(fmtVolume(-999)).toBe('-999');
    expect(fmtVolume(-1_500)).toBe('-1.5K');
    expect(fmtVolume(-2_500_000)).toBe('-2.50M');
    expect(fmtVolume(-999_999)).toBe('-1.00M');
  });

  it('passes a value that is not finite through as before', () => {
    expect(fmtVolume(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(fmtVolume(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
    expect(fmtVolume(Number.NaN)).toBe('NaN');
  });
});

describe('fmtDate', () => {
  const ms = Date.UTC(2024, 0, 15, 12); // noon UTC avoids day-rollover by timezone

  it('returns an empty string for non-finite input', () => {
    expect(fmtDate(NaN)).toBe('');
    expect(fmtDate(Infinity)).toBe('');
  });

  it('formats medium style by default (Mon D, YYYY)', () => {
    expect(fmtDate(ms)).toBe(fmtDate(ms, 'medium'));
    expect(fmtDate(ms, 'medium')).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });

  it('formats short style as M/D/YY', () => {
    expect(fmtDate(ms, 'short')).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2}$/);
  });
});

describe('fmtCurrency', () => {
  it('formats USD with a symbol and grouping by default', () => {
    expect(fmtCurrency(1234.5)).toBe('$1,234.50');
    expect(fmtCurrency(0)).toBe('$0.00');
  });

  it('honours an explicit decimals override', () => {
    expect(fmtCurrency(1234.5, 'USD', 'en-US', 0)).toBe('$1,235');
  });

  it('returns empty for non-finite input', () => {
    expect(fmtCurrency(NaN)).toBe('');
  });

  it('falls back to a fixed-decimal number for an unknown currency code', () => {
    expect(fmtCurrency(12.5, 'NOTACODE')).toBe('12.50');
  });
});

describe('relativeTime', () => {
  const now = Date.UTC(2024, 0, 15, 12);
  const ago = (sec: number) => relativeTime(now - sec * 1000, now);

  it('reports recent times as "just now"', () => {
    expect(ago(10)).toBe('just now');
  });

  it('scales through minutes/hours/days with correct pluralization', () => {
    expect(ago(60)).toBe('1 min ago');
    expect(ago(120)).toBe('2 mins ago');
    expect(ago(3600)).toBe('1 hour ago');
    expect(ago(7200)).toBe('2 hours ago');
    expect(ago(86_400)).toBe('1 day ago');
    expect(ago(2 * 86_400)).toBe('2 days ago');
  });

  it('handles future times with an "in" prefix', () => {
    expect(relativeTime(now + 3600 * 1000, now)).toBe('in 1 hour');
    expect(relativeTime(now + 5 * 1000, now)).toBe('soon');
  });

  it('returns empty for non-finite input', () => {
    expect(relativeTime(NaN, now)).toBe('');
  });
});

describe('locale-aware formatting', () => {
  it('formats prices with the given locale', () => {
    expect(fmtPrice(1234.5, 'de-DE')).toBe('1.234,50');
    expect(fmtPrice(1234.5)).toBe('1,234.50');
  });

  it('formats dates with the given locale', () => {
    const ms = Date.UTC(2024, 0, 15, 12);
    expect(fmtDate(ms, 'medium', 'en-US')).toBe('Jan 15, 2024');
    expect(fmtDate(ms, 'medium', 'vi-VN')).not.toBe('Jan 15, 2024');
  });

  it('formats relative time through Intl when a locale is given', () => {
    const now = Date.UTC(2024, 0, 15, 12);
    expect(relativeTime(now - 3 * 3600_000, now)).toBe('3 hours ago');
    expect(relativeTime(now - 3 * 3600_000, now, 'en-US')).toBe('3 hours ago');
    expect(relativeTime(now - 3 * 3600_000, now, 'vi-VN')).not.toBe('3 hours ago');
  });
});

describe('cached Intl formatting', () => {
  const LOCALES = ['en-US', 'vi-VN', 'de-DE', 'ja-JP'];
  const values = [0, -0, 1, -1.005, 12.345, 1234567.891, -98765.4321, NaN, Infinity, 1e21];

  it('fmtPrice matches toLocaleString in every locale, repeated calls included', () => {
    for (const locale of LOCALES) {
      for (let pass = 0; pass < 2; pass++) {
        for (const v of values) {
          expect(fmtPrice(v, locale)).toBe(v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      }
    }
  });

  it('fmtDate matches toLocaleDateString for both styles', () => {
    const times = [0, Date.UTC(2026, 9, 23, 7, 30), Date.UTC(1999, 11, 31, 23, 59)];
    for (const locale of LOCALES) {
      for (const ms of times) {
        expect(fmtDate(ms, 'medium', locale)).toBe(new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }));
        expect(fmtDate(ms, 'short', locale)).toBe(new Date(ms).toLocaleDateString(locale, { month: 'numeric', day: 'numeric', year: '2-digit' }));
      }
    }
  });

  it('fmtCurrency keeps one formatter per currency and decimals', () => {
    expect(fmtCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
    expect(fmtCurrency(1234.5, 'VND', 'vi-VN', 0)).toBe((1234.5).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    expect(fmtCurrency(1234.5, 'USD', 'en-US', 0)).toBe('$1,235');
    expect(fmtCurrency(1.5, 'NOT-A-CODE')).toBe('1.50'); // invalid code: the fallback, and nothing cached
  });

  it('a string passed from untyped code keeps its old fmtPrice output', () => {
    expect(fmtPrice('12.5' as unknown as number)).toBe('12.5');
  });
});
