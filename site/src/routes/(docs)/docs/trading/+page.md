---
title: Market conventions
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

APAC boards colour by position relative to the daily **price limit**, not just
up/down: purple at the ceiling (limit up), cyan at the floor (limit down),
yellow at the unchanged reference, green/red for an ordinary move — a signal a
plain up/down grid can't give you. `bo-grid/trading` is the pure-function
toolkit for that, plus tick-aware price formatting and session state. It's a
**separate entry**, like realtime — no `ColumnDef` changes, wired up
through the `cell`/`render` hook you already have:

```ts
import { vnBands, resolveTone, toneColor, fmtTradingPrice, vnTickSize } from 'bo-grid/trading';

const bands = vnBands(row.ref, 'HOSE');       // { ref, ceiling, floor } — tick-rounded
const tone = resolveTone(row.price, bands);   // 'ceiling' | 'floor' | 'ref' | 'up' | 'down'
const color = toneColor(tone);                // CSS colour for that tone
const text = fmtTradingPrice(row.price, vnTickSize(row.price, 'HOSE')); // "68,500", not "68500.00"
```

`toneColor` uses `darkToneColors` unless told otherwise. On a light theme, pass
`lightToneColors` (`toneColor(tone, lightToneColors)`). Each palette keeps
every tone at WCAG AA (4.5:1) on the grid's presets for its side, and a partial
object overrides single tones.

```ts
import { sessionStateAt, sessionLabel, VN_HOSE_SCHEDULE } from 'bo-grid/trading';

sessionStateAt(new Date(), VN_HOSE_SCHEDULE); // 'pre-open' | 'ato' | 'continuous' | 'break' | 'atc' | 'closed'
```

`vnBands`/`vnTickSize` encode HOSE's price-step schedule and HOSE/HNX/UPCOM's
daily band widths (7%/10%/15%), rounding the ceiling **down** and the floor
**up** to a tradable tick so neither ever sits outside the real regulatory
limit. VN30 index futures trade on a 0.1-point step with a ±7% band:
`vnFuturesBands(ref)` gives their ceiling and floor the same way, and
`fmtTradingPrice(price, VN_FUTURES_TICK)` shows one decimal. `sessionStateAt` evaluates the schedule in the exchange's own time zone
via `Intl`, so it's correct for a viewer anywhere, not just one in Vietnam. None
of this is required to use `resolveTone`/`toneColor` — pass your own
`{ ref, ceiling, floor }` for any other market's limit-price rule. See the **VN
board** demo for it composed with `bo-grid/realtime`.

**FX.** A pair's pip is 0.01 when it is quoted in yen and 0.0001 otherwise
(`fxPipSize`, which reads the pair from its first six letters, so a broker's
suffix such as `USDJPY.m` is fine); pass a pip size (below 1) instead of a
pair for metals, currencies with another pip (HUF, KRW) or a broker's own
convention. A dealing screen shows a quote with the big figure small, the pips
large and the pipette raised:

```ts
import { fxQuoteHtml, fxQuoteParts, pipsBetween, fxMarketOpen, fxCentresOpen } from 'bo-grid/trading';

fxQuoteParts(1.08452, 'EUR/USD'); // { big: '1.08', pips: '45', pipette: '2' }
const bid: ColumnDef = { type: 'custom', key: 'bid', header: 'Bid', render: ({ row }) => fxQuoteHtml(row.bid, row.pair) };
pipsBetween(ask, bid, 'EUR/USD');  // the spread, in pips, to a tenth
fxMarketOpen(new Date());          // Sunday 17:00 to Friday 17:00, New York time
fxCentresOpen(new Date());         // e.g. ['London', 'New York']: the overlap
```

`fxQuoteHtml` puts each part in a class of its own (`bo-fx-big`, `bo-fx-pips`,
`bo-fx-pipette`) with inline defaults you can override. The centres are Sydney,
Tokyo, London and New York in their own business hours, so summer time moves
them as it does on the street.

**Crypto.** The market never closes: `sessionStateAt(now, CRYPTO_SCHEDULE,
{ timeZone: 'UTC', skipWeekends: false })` reads `'continuous'`. One watchlist
runs from 63,250 down to 0.0000012, where no fixed decimal count suits every
row: `fmtSigPrice(price)` shows five significant digits (and every digit of a
large price's integer part). Where you know a symbol's tick, `fmtTradingPrice`
shows it exactly, and `roundToTick(qty, step, 'down')` rounds a size to its
lot step. See the **FX & crypto** demo.

**Basis points and fractional prices.** `fmtBps(fraction)` shows a fraction in
basis points: pass `(ask - bid) / mid` for a spread, or `(y1 - y0) / 100` for a
move in a yield quoted in percent. Treasuries are quoted as a whole number and
32nds: `fmtFraction` writes them and `parseFraction` reads them back, so a
price column can be edited the way it is quoted:

```ts
import { fmtBps, fmtFraction, parseFraction } from 'bo-grid/trading';

fmtBps(0.00125);                       // '12.5 bp'
fmtBps(-0.0005, { sign: true });       // '-5.0 bp'; unit: '' when the header says bp
fmtFraction(99.515625, { sub: 2 });    // '99-16+': 99 and 16½ 32nds
fmtFraction(99.5078125, { sub: 4 });   // '99-162': quarters as 2, + and 6
fmtFraction(99.5078125, { sub: 4, style: 'futures' }); // "99'162": quarters as 2, 5 and 7
fmtFraction(450.25, { denominator: 8, separator: "'" }); // "450'2", a grain price in eighths
const quote = { sub: 2 } as const;
const px: ColumnDef = {
  type: 'number', key: 'px', header: 'Price', editable: true,
  format: (v) => fmtFraction(Number(v), quote),
  parse: (raw) => parseFraction(raw, quote),  // '99-16+' or 99.515625; anything else is refused
};
```

Cash Treasuries write the last character in eighths of a 32nd (`+` for the
half), while futures screens write its first decimal digit (`5` for the
half), so `'99-165'` and `"99'165"` are different prices. Give `parseFraction`
the same options the column formats with, so an order is never entered at the
other one.

## Live example

<Example id="vnboard" />

<Example id="fxcrypto" />
