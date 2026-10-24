import { describe, expect, it } from 'vitest';
import { CRYPTO_SCHEDULE, fmtSigPrice } from './crypto';
import { sessionStateAt } from './session';

describe('CRYPTO_SCHEDULE', () => {
  it('is continuous at any hour, weekends too', () => {
    for (const iso of ['2026-10-24T00:00:00Z', '2026-10-25T13:37:00Z', '2026-10-21T23:59:00Z']) {
      expect(sessionStateAt(new Date(iso), CRYPTO_SCHEDULE, { timeZone: 'UTC', skipWeekends: false })).toBe('continuous');
    }
  });
});

describe('fmtSigPrice', () => {
  it('shows prices of any size to five significant digits', () => {
    expect(fmtSigPrice(63250)).toBe('63,250');
    expect(fmtSigPrice(3456.789)).toBe('3,456.8');
    expect(fmtSigPrice(0.5234567)).toBe('0.52346');
    expect(fmtSigPrice(0.0000123456)).toBe('0.000012346');
  });

  it('keeps every digit of the integer part of a large price', () => {
    expect(fmtSigPrice(1234567.8)).toBe('1,234,568');
    expect(fmtSigPrice(63250.4, 3)).toBe('63,250');
  });

  it('takes the digits and locale, and gives nothing for a price that is not a number', () => {
    expect(fmtSigPrice(0.0000123456, 3)).toBe('0.0000123');
    expect(fmtSigPrice(3456.789, 5, 'de-DE')).toBe('3.456,8');
    expect(fmtSigPrice(Number.NaN)).toBe('');
    expect(fmtSigPrice(-0)).toBe('0');
    expect(fmtSigPrice(0.5234567, Number.NaN)).toBe('0.52346');
  });
});
