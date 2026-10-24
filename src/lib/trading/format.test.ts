import { describe, it, expect } from 'vitest';
import { decimalsForTick, fmtBps, fmtFraction, fmtTradingPrice, parseFraction } from './format';

describe('decimalsForTick', () => {
  it('is 0 for a whole-number tick (e.g. VND)', () => {
    expect(decimalsForTick(10)).toBe(0);
    expect(decimalsForTick(100)).toBe(0);
    expect(decimalsForTick(1)).toBe(0);
  });

  it('matches the tick\'s own decimal places (e.g. a cent tick, an FX pip)', () => {
    expect(decimalsForTick(0.01)).toBe(2);
    expect(decimalsForTick(0.0001)).toBe(4);
  });

  it('handles a tick with trailing float imprecision (0.1 in IEEE-754)', () => {
    expect(decimalsForTick(0.1)).toBe(1);
  });

  it('handles a sub-pip tick that Number#toString renders in exponential notation', () => {
    // (0.0000001).toString() === '1e-7' — a naive string-split on "." would
    // silently see no decimal point and report 0.
    expect(decimalsForTick(0.0000001)).toBe(7);
    expect(decimalsForTick(0.00000001)).toBe(8); // an 8-decimal crypto tick
  });

  it('does not throw on a non-finite or absurdly large tick', () => {
    expect(decimalsForTick(NaN)).toBe(0);
    expect(decimalsForTick(Infinity)).toBe(0);
    expect(decimalsForTick(1e30)).toBe(0);
  });
});

describe('fmtTradingPrice', () => {
  it('formats a whole-VND price with no decimals and thousands separators', () => {
    expect(fmtTradingPrice(10_700, 50)).toBe('10,700');
  });

  it('formats a cent-tick price with 2 decimals', () => {
    expect(fmtTradingPrice(123.4, 0.01)).toBe('123.40');
  });

  it('formats a pip-tick FX price with 4 decimals', () => {
    expect(fmtTradingPrice(1.2345, 0.0001)).toBe('1.2345');
  });

  it('returns an empty string for a non-finite value', () => {
    expect(fmtTradingPrice(NaN, 50)).toBe('');
  });
});

describe('fmtBps', () => {
  it('shows a fraction in basis points, to a tenth by default', () => {
    expect(fmtBps(0.00125)).toBe('12.5 bp');
    expect(fmtBps(0.0012, { decimals: 0 })).toBe('12 bp');
    expect(fmtBps(-0.0003)).toBe('-3.0 bp');
  });

  it('signs a change on request, and never shows a negative zero', () => {
    expect(fmtBps(0.0005, { sign: true })).toBe('+5.0 bp');
    expect(fmtBps(-0.0005, { sign: true })).toBe('-5.0 bp');
    expect(fmtBps(0, { sign: true })).toBe('0.0 bp');
    expect(fmtBps(-0.000000001, { sign: true })).toBe('0.0 bp');
    expect(fmtBps(-0.000000001)).toBe('0.0 bp');
  });

  it('takes a unit and a locale, and gives nothing for a value that is not a number', () => {
    expect(fmtBps(0.00125, { unit: '' })).toBe('12.5');
    expect(fmtBps(0.00125, { unit: 'bps' })).toBe('12.5 bps');
    expect(fmtBps(0.00125, { locale: 'de-DE' })).toBe('12,5 bp');
    expect(fmtBps(Number.NaN)).toBe('');
    expect(fmtBps(1e305)).toBe('');
  });

  it('rounds a tie the same way on either side of zero', () => {
    expect(fmtBps(-0.000025)).toBe(`-${fmtBps(0.000025)}`);
    expect(fmtBps(-0.00125, { decimals: 0 })).toBe(`-${fmtBps(0.00125, { decimals: 0 })}`);
    expect(fmtBps(0.00125, { decimals: Number.NaN })).toBe('12.5 bp');
  });
});

describe('fmtFraction', () => {
  it('writes a price in 32nds, the way Treasuries are quoted', () => {
    expect(fmtFraction(99.5)).toBe('99-16');
    expect(fmtFraction(101.03125)).toBe('101-01');
    expect(fmtFraction(99)).toBe('99-00');
  });

  it('adds a last character for a part of a 32nd', () => {
    // Halves: + is half a 32nd (a 64th).
    expect(fmtFraction(99 + 16.5 / 32, { sub: 2 })).toBe('99-16+');
    // Quarters, written in eighths: 2 a quarter, + a half, 6 three quarters.
    expect(fmtFraction(99 + 16.25 / 32, { sub: 4 })).toBe('99-162');
    expect(fmtFraction(99 + 16.5 / 32, { sub: 4 })).toBe('99-16+');
    expect(fmtFraction(99 + 16.75 / 32, { sub: 4 })).toBe('99-166');
    // Eighths.
    expect(fmtFraction(99 + 16.375 / 32, { sub: 8 })).toBe('99-163');
    expect(fmtFraction(99 + 16 / 32, { sub: 8 })).toBe('99-16');
  });

  it('rounds to the nearest step and carries into the handle', () => {
    expect(fmtFraction(99.999)).toBe('100-00');
    expect(fmtFraction(99 + 16.4 / 32, { sub: 2 })).toBe('99-16+');
    expect(fmtFraction(99 + 16.2 / 32, { sub: 2 })).toBe('99-16');
  });

  it('keeps the sign of a negative price (a spread), but not of a zero', () => {
    expect(fmtFraction(-0.25)).toBe('-0-08');
    expect(fmtFraction(-(1 + 8.5 / 32), { sub: 2 })).toBe('-1-08+');
    expect(fmtFraction(-0.0001)).toBe('0-00');
  });

  it('writes the futures style: decimal digits of a 32nd, an apostrophe', () => {
    const futures = { sub: 4, style: 'futures' } as const;
    expect(fmtFraction(110 + 16.5 / 32, futures)).toBe("110'165");
    expect(fmtFraction(110 + 16.25 / 32, futures)).toBe("110'162");
    expect(fmtFraction(110 + 16.75 / 32, futures)).toBe("110'167");
    expect(fmtFraction(110.5, futures)).toBe("110'160");
    expect(fmtFraction(110 + 16.125 / 32, { sub: 8, style: 'futures' })).toBe("110'161");
    expect(fmtFraction(110 + 16.875 / 32, { sub: 8, style: 'futures' })).toBe("110'168");
    expect(fmtFraction(120.5, { style: 'futures' })).toBe("120'16");
  });

  it('takes another denominator and separator (grains in eighths)', () => {
    expect(fmtFraction(450.25, { denominator: 8, separator: "'" })).toBe("450'2");
    expect(fmtFraction(99 + 33 / 64, { denominator: 64 })).toBe('99-33');
  });

  it('gives nothing for a price that is not a number or options it cannot use', () => {
    expect(fmtFraction(Number.NaN)).toBe('');
    expect(fmtFraction(1e16)).toBe('');
    expect(fmtFraction(99.5, { denominator: 1 })).toBe('');
    expect(fmtFraction(99.5, { denominator: 2.5 })).toBe('');
    expect(fmtFraction(99.5, { sub: 3 as 2 })).toBe('');
    expect(fmtFraction(99.5, { style: 'toString' as 'cash' })).toBe('');
  });
});

describe('parseFraction', () => {
  it('reads what fmtFraction writes', () => {
    expect(parseFraction('99-16')).toBe(99.5);
    expect(parseFraction('99-16+')).toBe(99 + 16.5 / 32);
    expect(parseFraction('99-162')).toBe(99 + 16.25 / 32);
    expect(parseFraction('99-166')).toBe(99 + 16.75 / 32);
    expect(parseFraction('99-164')).toBe(99 + 16.5 / 32);
    expect(parseFraction('-0-08')).toBe(-0.25);
    expect(parseFraction("450'2", { denominator: 8 })).toBe(450.25);
    expect(parseFraction(' 99-16+ ')).toBe(99 + 16.5 / 32);
  });

  it('round-trips every eighth of a 32nd', () => {
    for (let steps = 0; steps < 256 * 3; steps++) {
      const price = 98 + steps / 256;
      expect(parseFraction(fmtFraction(price, { sub: 8 }))).toBe(price);
    }
  });

  it('reads the last digit in the style given, so a futures half is not five eighths', () => {
    expect(parseFraction('99-165')).toBe(99 + 16.625 / 32);
    expect(parseFraction("110'165", { style: 'futures' })).toBe(110 + 16.5 / 32);
    expect(parseFraction("110'167", { style: 'futures' })).toBe(110 + 16.75 / 32);
    expect(parseFraction("110'160", { style: 'futures' })).toBe(110.5);
    expect(parseFraction("110'16+", { style: 'futures' })).toBe(110 + 16.5 / 32);
    expect(parseFraction("110'164", { style: 'futures' })).toBeNaN();
    expect(parseFraction("110'169", { style: 'futures' })).toBeNaN();
    for (let steps = 0; steps < 256 * 2; steps++) {
      const price = 109 + steps / 256;
      const opts = { sub: 8, style: 'futures' } as const;
      expect(parseFraction(fmtFraction(price, opts), opts)).toBe(price);
    }
  });

  it('takes a pasted en dash, and never gives a negative zero', () => {
    expect(parseFraction('99–16')).toBe(99.5);
    expect(Object.is(parseFraction('-0-00'), 0)).toBe(true);
    expect(Object.is(parseFraction('-0'), 0)).toBe(true);
  });

  it('takes a short count of parts and a plain decimal', () => {
    expect(parseFraction('99-1')).toBe(99 + 1 / 32);
    expect(parseFraction('99.515625')).toBe(99.515625);
    expect(parseFraction('99')).toBe(99);
    expect(parseFraction('-1.5')).toBe(-1.5);
  });

  it('gives NaN for text it cannot read, so an edit is refused', () => {
    expect(parseFraction('99-32')).toBeNaN();
    expect(parseFraction('99-16x')).toBeNaN();
    expect(parseFraction('99-168')).toBeNaN();
    expect(parseFraction('')).toBeNaN();
    expect(parseFraction('abc')).toBeNaN();
    expect(parseFraction('99-16', { denominator: 1 })).toBeNaN();
    expect(parseFraction('99-16', { style: 'other' as 'cash' })).toBeNaN();
  });
});
