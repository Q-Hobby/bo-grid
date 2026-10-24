import { describe, it, expect } from 'vitest';
import { vnTickSize, roundToTick, vnBandPercent, vnBands, vnFuturesBands, VN_FUTURES_TICK } from './bands';

describe('vnTickSize', () => {
  it('is 10 VND below 10,000', () => {
    expect(vnTickSize(9_999)).toBe(10);
    expect(vnTickSize(500)).toBe(10);
  });

  it('is 50 VND from 10,000 up to (not including) 50,000', () => {
    expect(vnTickSize(10_000)).toBe(50);
    expect(vnTickSize(49_950)).toBe(50);
  });

  it('is 100 VND at and above 50,000', () => {
    expect(vnTickSize(50_000)).toBe(100);
    expect(vnTickSize(250_000)).toBe(100);
  });

  it('uses a flat 100 VND tick for HNX and UPCOM', () => {
    expect(vnTickSize(5_000, 'HNX')).toBe(100);
    expect(vnTickSize(80_000, 'UPCOM')).toBe(100);
  });
});

describe('roundToTick', () => {
  it('rounds down to the nearest tick by default at a boundary (ceiling use)', () => {
    expect(roundToTick(10_734, 50, 'down')).toBe(10_700);
  });

  it('rounds up to the nearest tick (floor use)', () => {
    expect(roundToTick(10_701, 50, 'up')).toBe(10_750);
  });

  it('rounds to the nearest tick when mode is "nearest"', () => {
    expect(roundToTick(10_724, 50, 'nearest')).toBe(10_700);
    expect(roundToTick(10_726, 50, 'nearest')).toBe(10_750);
  });

  it('is a no-op on an exact multiple of the tick', () => {
    expect(roundToTick(10_700, 50, 'down')).toBe(10_700);
    expect(roundToTick(10_700, 50, 'up')).toBe(10_700);
  });

  it('handles a fractional tick (e.g. an FX pip) without float drift', () => {
    expect(roundToTick(1.23456, 0.0001, 'down')).toBeCloseTo(1.2345, 10);
    expect(roundToTick(1.23456, 0.0001, 'up')).toBeCloseTo(1.2346, 10);
  });

  it('keeps every digit of a tick such as 0.25, 0.125 or 2.5', () => {
    expect(roundToTick(1.75, 0.25)).toBe(1.75);
    expect(roundToTick(5000.75, 0.25)).toBe(5000.75);
    expect(roundToTick(5000.8, 0.25, 'down')).toBe(5000.75);
    expect(roundToTick(0.375, 0.125)).toBe(0.375);
    expect(roundToTick(9.9, 2.5, 'down')).toBe(7.5);
    expect(roundToTick(10.1, 2.5, 'up')).toBe(12.5);
    expect(roundToTick(0.0175, 0.0025)).toBe(0.0175);
  });
});

describe('vnBandPercent', () => {
  it('is 7% on HOSE, 10% on HNX, 15% on UPCOM', () => {
    expect(vnBandPercent('HOSE')).toBe(0.07);
    expect(vnBandPercent('HNX')).toBe(0.1);
    expect(vnBandPercent('UPCOM')).toBe(0.15);
  });
});

describe('vnBands', () => {
  it('computes ceiling rounded DOWN and floor rounded UP from the reference price', () => {
    // HOSE, ref 10,000 → tick 50, ±7% → raw ceiling 10,700 (exact), raw floor 9,300 (exact)
    const b = vnBands(10_000, 'HOSE');
    expect(b.ref).toBe(10_000);
    expect(b.ceiling).toBe(10_700);
    expect(b.floor).toBe(9_300);
  });

  it('never rounds the ceiling above the true 7% band (would let trades exceed the real limit)', () => {
    // ref 10,734 → 7% → 11,485.38 (raw); tick is 50 (still <50,000) → must round DOWN to a tick.
    const b = vnBands(10_734, 'HOSE');
    expect(b.ceiling).toBeLessThanOrEqual(10_734 * 1.07);
  });

  it('never rounds the floor below the true 7% band', () => {
    const b = vnBands(10_734, 'HOSE');
    expect(b.floor).toBeGreaterThanOrEqual(10_734 * 0.93);
  });

  it('defaults to HOSE when no exchange is given', () => {
    expect(vnBands(10_000)).toEqual(vnBands(10_000, 'HOSE'));
  });

  // Regression: a ceiling/floor rounded using the REFERENCE price's tick can
  // land on a price that isn't a valid tick for its OWN price tier when the
  // ±% band crosses the 10,000 or 50,000 VND boundary — a ceiling/floor that
  // "isn't tradable" is exactly the bug `vnBands` exists to prevent.
  function assertTickAligned(price: number, exchange: 'HOSE' | 'HNX' | 'UPCOM') {
    const tick = vnTickSize(price, exchange);
    // Compare in tick units with a tolerance for float noise rather than `% tick
    // === 0`, which is unreliable for a fractional tick.
    const units = price / tick;
    expect(Math.abs(units - Math.round(units))).toBeLessThan(1e-6);
  }

  it('rounds the ceiling to a tick valid at the CEILING price, not the reference price, when the band crosses the 10,000 tier boundary', () => {
    // ref 9,500 → raw ceiling 10,165 crosses from the <10,000 tier (tick 10)
    // into the 10,000–50,000 tier (tick 50).
    const b = vnBands(9_500, 'HOSE');
    assertTickAligned(b.ceiling!, 'HOSE');
    expect(b.ceiling).toBeLessThanOrEqual(9_500 * 1.07);
  });

  it('rounds the ceiling to a tick valid at the CEILING price when the band crosses the 50,000 tier boundary', () => {
    // ref 48,000 → raw ceiling 51,360 crosses from the 10,000–50,000 tier
    // (tick 50) into the ≥50,000 tier (tick 100).
    const b = vnBands(48_000, 'HOSE');
    assertTickAligned(b.ceiling!, 'HOSE');
    expect(b.ceiling).toBeLessThanOrEqual(48_000 * 1.07);
  });

  it('rounds the floor to a tick valid at the FLOOR price when the band crosses a tier boundary downward', () => {
    // ref 10,500 → raw floor 9,765 crosses from the 10,000–50,000 tier (tick
    // 50) down into the <10,000 tier (tick 10).
    const b = vnBands(10_500, 'HOSE');
    assertTickAligned(b.floor!, 'HOSE');
    expect(b.floor).toBeGreaterThanOrEqual(10_500 * 0.93);
  });

  // Sweep starts at 1,000 VND, not 0 — below roughly that, UPCOM's flat 100 VND
  // tick can exceed the 15% band width itself (e.g. ref 137 → a 15% ceiling of
  // ~157 rounds DOWN to the tick below it, 100, which is below ref). That's a
  // real domain edge case (what's the correct ceiling when the exchange's
  // minimum tick is wider than the daily band?), not a bug this module
  // resolves — realistic VN equity prices don't trade that low.
  const REALISTIC_MIN_REF = 1_000;

  it('produces a tick-aligned ceiling and floor across a sweep of reference prices, including every tier boundary', () => {
    for (let ref = REALISTIC_MIN_REF; ref <= 200_000; ref += 37) {
      for (const exchange of ['HOSE', 'HNX', 'UPCOM'] as const) {
        const b = vnBands(ref, exchange);
        assertTickAligned(b.ceiling!, exchange);
        assertTickAligned(b.floor!, exchange);
      }
    }
  });

  it('always satisfies ceiling >= ref >= floor — resolveTone\'s precondition for a correct classification', () => {
    for (let ref = REALISTIC_MIN_REF; ref <= 200_000; ref += 37) {
      for (const exchange of ['HOSE', 'HNX', 'UPCOM'] as const) {
        const b = vnBands(ref, exchange);
        expect(b.ceiling!).toBeGreaterThanOrEqual(b.ref);
        expect(b.ref).toBeGreaterThanOrEqual(b.floor!);
      }
    }
  });
});

describe('float noise at a whole tick', () => {
  it('keeps a raw band that lands exactly on a tick (12,000 × 1.15 = 13,799.999…)', () => {
    expect(vnBands(12_000, 'UPCOM').ceiling).toBe(13_800);
    expect(vnBands(6_000, 'UPCOM').ceiling).toBe(6_900);
  });

  it('rounds every band that is a whole number of ticks to exactly that price', () => {
    const pct = { HOSE: 7, HNX: 10, UPCOM: 15 } as const;
    for (const exchange of ['HOSE', 'HNX', 'UPCOM'] as const) {
      for (let ref = 1_000; ref <= 300_000; ref += exchange === 'HOSE' ? 10 : 100) {
        if (ref % vnTickSize(ref, exchange)) continue;
        // Integer math: the exact raw band, when it is itself a tradable price.
        const b = vnBands(ref, exchange);
        const rawC = (ref * (100 + pct[exchange])) / 100;
        const rawF = (ref * (100 - pct[exchange])) / 100;
        if (Number.isInteger(rawC) && rawC % vnTickSize(rawC, exchange) === 0) expect(b.ceiling).toBe(rawC);
        if (Number.isInteger(rawF) && rawF % vnTickSize(rawF, exchange) === 0) expect(b.floor).toBe(rawF);
      }
    }
  });

  it('still rounds a price just off a tick in the requested direction', () => {
    expect(roundToTick(13_799.9, 100, 'down')).toBe(13_700);
    expect(roundToTick(13_700.1, 100, 'up')).toBe(13_800);
  });
});

describe('vnFuturesBands', () => {
  it('is ±7% of the reference on a 0.1-point step', () => {
    expect(VN_FUTURES_TICK).toBe(0.1);
    expect(vnFuturesBands(1_250.3)).toEqual({ ref: 1_250.3, ceiling: 1_337.8, floor: 1_162.8 });
  });

  it('keeps an exact band (1,300 × 1.07 = 1,391; 1,000 × 0.93 = 930)', () => {
    expect(vnFuturesBands(1_300).ceiling).toBe(1_391);
    expect(vnFuturesBands(1_000).floor).toBe(930);
  });

  it('stays on the step and inside the limit across a sweep', () => {
    for (let ref = 800; ref <= 2_000; ref += 0.7) {
      const r = Math.round(ref * 10) / 10;
      const b = vnFuturesBands(r);
      expect(Math.abs(b.ceiling! * 10 - Math.round(b.ceiling! * 10))).toBeLessThan(1e-6);
      expect(Math.abs(b.floor! * 10 - Math.round(b.floor! * 10))).toBeLessThan(1e-6);
      expect(b.ceiling!).toBeLessThanOrEqual(r * 1.07 + 1e-9);
      expect(b.floor!).toBeGreaterThanOrEqual(r * 0.93 - 1e-9);
      expect(b.ceiling! - r * 1.07).toBeGreaterThan(-0.1);
    }
  });
});
