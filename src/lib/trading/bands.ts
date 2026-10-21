// Vietnam exchange price bands — tick sizes and daily ceiling/floor limits,
// for stocks and for VN30 index futures.
//
// These are the standard, non-special-session rules (no IPO/first-day widened
// band, no ex-dividend reference adjustment). They're the common case a trading
// screen needs; a broker with more exact business rules should compute bands
// server-side and pass them straight to `resolveTone` (see ./tone.ts) — nothing
// here is required to use the tone/colour machinery.

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM';

/** Reference/ceiling/floor for one symbol on one trading day. Consumer-supplied
    bands (e.g. from a real-time reference feed) use this same shape. */
export interface ToneBands {
  ref: number;
  ceiling?: number;
  floor?: number;
}

/** HOSE's price-step schedule (VND): the tick widens as price rises. HNX and
    UPCOM use a flat 100 VND tick regardless of price. */
function hoseTickSize(price: number): number {
  if (price < 10_000) return 10;
  if (price < 50_000) return 50;
  return 100;
}

/** The minimum price increment at this price, per exchange. Ceiling/floor
    prices must land on a tick — a screen or an order at 10,734 VND on HOSE
    isn't tradable. */
export function vnTickSize(price: number, exchange: Exchange = 'HOSE'): number {
  return exchange === 'HOSE' ? hoseTickSize(price) : 100;
}

/** How close (in ticks) a price must be to a whole tick to count as one. */
const TICK_EPSILON = 1e-9;

/**
 * Round `price` to the nearest multiple of `tick`.
 *
 * - `'down'` — never exceeds `price` (use for a ceiling: the true band's exact
 *   7% may not land on a tick, and rounding UP would let the ceiling sit above
 *   the real regulatory limit).
 * - `'up'` — never goes below `price` (use for a floor, for the same reason in
 *   the other direction).
 * - `'nearest'` — plain rounding, for display/snapping rather than a limit.
 *
 * Works in tick units internally (not `price / tick`) to avoid the float drift
 * that shows up with fractional ticks like an FX pip (`0.0001`).
 */
export function roundToTick(price: number, tick: number, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  // A price that is a whole number of ticks can arrive with float noise
  // (12,000 × 1.15 = 13,799.999999999998), and flooring that would drop a whole
  // tick. Snap to the whole tick count first when it is that close.
  const raw = price / tick;
  const whole = Math.round(raw);
  const units = Math.abs(raw - whole) <= TICK_EPSILON ? whole : raw;
  const rounded = mode === 'down' ? Math.floor(units) : mode === 'up' ? Math.ceil(units) : Math.round(units);
  // Round the final multiplication to the tick's own precision to clear any
  // residual float noise (e.g. 0.0001 * 12346 !== exactly 1.2346).
  const decimals = Math.max(0, -Math.floor(Math.log10(tick) + 1e-9));
  return Number((rounded * tick).toFixed(decimals));
}

/** The daily price-band width, as a fraction of the reference price. */
export function vnBandPercent(exchange: Exchange): number {
  switch (exchange) {
    case 'HOSE':
      return 0.07;
    case 'HNX':
      return 0.1;
    case 'UPCOM':
      return 0.15;
  }
}

// HOSE's tick size is a function of PRICE, not of the reference price a band is
// computed from — it's a step function with breakpoints at 10,000 and 50,000
// VND. Rounding a raw ±% price with the tick implied by `ref` is only correct
// when the band doesn't cross one of those breakpoints; when it does (e.g. ref
// 9,500 → ceiling raw 10,165, crossing from the 10-VND tier into the 50-VND
// one), the result must be re-rounded with the tick valid AT THE ROUNDED PRICE
// itself, or it lands on a price that isn't actually tradable.
//
// This is a small fixed-point search: start from the tick implied by the raw
// price, round, then check whether the candidate's OWN tick agrees; if not,
// re-round with that tick. Bounded at 5 iterations — HOSE's schedule has only
// two breakpoints, so two corrections is the practical ceiling, but a market
// with a longer step schedule stays safe under the same loop.
function roundBand(rawPrice: number, exchange: Exchange, mode: 'down' | 'up'): number {
  let tick = vnTickSize(rawPrice, exchange);
  let candidate = roundToTick(rawPrice, tick, mode);
  for (let i = 0; i < 5; i++) {
    const nextTick = vnTickSize(candidate, exchange);
    if (nextTick === tick) break;
    tick = nextTick;
    candidate = roundToTick(rawPrice, tick, mode);
  }
  return candidate;
}

/**
 * Ceiling/floor for a reference price, per the standard daily band — ceiling
 * rounded down to a tradable tick, floor rounded up, so neither ever sits
 * outside the true regulatory limit NOR lands on a price its own tier
 * wouldn't actually trade at (see `roundBand` above for why that needs more
 * than a single round using `ref`'s tick).
 *
 * At an unrealistically low reference price — where the exchange's tick is
 * wider than the % band itself (e.g. UPCOM's flat 100 VND tick against a
 * ref well under ~700 VND) — the ceiling can round down to at or below `ref`.
 * No real VN equity trades that low; this isn't handled specially.
 */
export function vnBands(ref: number, exchange: Exchange = 'HOSE'): ToneBands {
  const pct = vnBandPercent(exchange);
  return {
    ref,
    ceiling: roundBand(ref * (1 + pct), exchange, 'down'),
    floor: roundBand(ref * (1 - pct), exchange, 'up'),
  };
}

/** VN30 index futures (HNX derivatives market): the price step, in index points. */
export const VN_FUTURES_TICK = 0.1;

/** VN30 index futures: the daily price-band width, as a fraction of the
    reference (the previous session's settlement price). */
export const VN_FUTURES_BAND = 0.07;

/**
 * Ceiling/floor for a VN30 index futures contract — ±7% of the reference,
 * ceiling rounded down and floor rounded up to the 0.1-point step. Standard
 * sessions only: a contract's first trading day uses a wider band; pass
 * server-side bands to `resolveTone` for that.
 */
export function vnFuturesBands(ref: number): ToneBands {
  return {
    ref,
    ceiling: roundToTick(ref * (1 + VN_FUTURES_BAND), VN_FUTURES_TICK, 'down'),
    floor: roundToTick(ref * (1 - VN_FUTURES_BAND), VN_FUTURES_TICK, 'up'),
  };
}
