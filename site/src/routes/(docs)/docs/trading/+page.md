---
title: Market conventions
description: Price-limit colours, tick sizes, session state, FX pips, crypto prices, basis points and 32nds — the market conventions of bo-grid/trading, as plain functions you wire into columns.
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Markets have conventions a generic grid knows nothing about. A Vietnamese board colours a price by where it sits in the day's price limit. A dealing screen shows an FX quote with its pips large. A Treasury price is written in 32nds. `bo-grid/trading` holds these conventions as plain functions: no component, and nothing added to `ColumnDef`. You wire them into a column through the hooks it already has: `format`, `cellClass`, `render` and `parse`. It is a separate entry, so an app that does not import it does not pay for it.

The board below colours each symbol and price by its price-limit tone: purple at the ceiling, cyan at the floor, yellow at the reference, green or red for an ordinary move. Prices step on the exchange's tick table and stay inside the daily band.

<Example name="trading" title="Price-limit tones" />

## Price-limit tones

APAC exchanges cap a day's move at a band around the reference price. Traders read a price by its place in that band, not only by its direction:

```ts
import { vnBands, resolveTone, toneColor, lightToneColors } from 'bo-grid/trading';

const bands = vnBands(68_500, 'HOSE');     // { ref: 68500, ceiling: 73200, floor: 63800 }
const tone = resolveTone(price, bands);    // 'ceiling' | 'floor' | 'ref' | 'up' | 'down'
toneColor(tone);                           // the dark palette's colour
toneColor(tone, lightToneColors);          // on a light theme
```

- `vnBands` knows HOSE, HNX and UPCOM's daily bands (7%, 10% and 15%). It rounds the ceiling down and the floor up to a tradable tick, so neither sits outside the real limit. VN30 index futures trade on a 0.1-point step with a ±7% band: `vnFuturesBands(ref)` gives their ceiling and floor.
- For any other market, pass your own `{ ref, ceiling, floor }` to `resolveTone`: the bands come from your reference-data feed.
- `darkToneColors` and `lightToneColors` keep every tone at WCAG AA (4.5:1) on the grid's presets for their side. `toneColor(tone, colours)` takes a whole palette or a partial one that overrides single tones.

Colour a column with `cellClass` and a class per tone. Set `flashColor: false` on a flashing column whose text carries the tone, so a flash lights only the background:

```ts
const tone = (_v: unknown, row: GridRow) => `tone-${resolveTone(Number(row.price), vnBands(Number(row.ref)))}`;
const columns: ColumnDef[] = [
  { type: 'text', key: 'symbol', header: 'Symbol', cellClass: tone },
  { type: 'number', key: 'price', header: 'Price', cellClass: tone, flash: 'auto', flashColor: false },
];
```

```css
:global(.bo-grid .c.tone-ceiling) { color: #e879f9; } /* and floor, ref, up, down */
```

## Tick sizes and prices

```ts
import { vnTickSize, roundToTick, fmtTradingPrice, decimalsForTick } from 'bo-grid/trading';

vnTickSize(68_500, 'HOSE');            // 100: HOSE's step widens as the price rises
roundToTick(68_537, 100, 'down');      // 68500 ('nearest' by default, or 'up')
fmtTradingPrice(68_500, 100);          // '68,500', not '68500.00'
fmtTradingPrice(1.08452, 0.00001);     // '1.08452': the tick's decimals
decimalsForTick(0.05);                 // 2
```

HOSE prices step by 10, 50 or 100 VND depending on the price; HNX and UPCOM use a flat 100. A ceiling or an order at a price off the tick is not tradable, which is why `vnBands` rounds to it. `fmtTradingPrice(price, VN_FUTURES_TICK)` shows a futures price with one decimal.

## Sessions

```ts
import { sessionStateAt, sessionLabel, VN_HOSE_SCHEDULE } from 'bo-grid/trading';

const state = sessionStateAt(new Date(), VN_HOSE_SCHEDULE); // 'pre-open' | 'ato' | 'continuous' | 'break' | 'atc' | 'closed'
sessionLabel(state);                                        // 'ATO', 'Continuous', …
```

`sessionStateAt` reads the schedule in the exchange's own time zone (`Asia/Ho_Chi_Minh` by default), so a trader in New York sees Ho Chi Minh City's session, not their own. Weekends read `'closed'` unless `skipWeekends: false`. A schedule is a list of `{ start, end, state }` windows in `HH:mm` that tile the day; write your own for another exchange and pass its `timeZone`. Holidays and half-days are not in the schedule: check them against your own trading calendar.

## FX

A pair's pip is 0.01 when the quote currency is the yen and 0.0001 otherwise. A dealing screen shows a quote with the big figure small, the pips large and the pipette raised:

<Example name="trading-fx" title="FX quotes" />

```ts
import { fxPipSize, fxQuoteParts, fxQuoteHtml, pipsBetween, fxMarketOpen, fxCentresOpen } from 'bo-grid/trading';

fxPipSize('USDJPY.m');             // 0.01: a broker's suffix is fine
fxQuoteParts(1.08452, 'EUR/USD');  // { big: '1.08', pips: '45', pipette: '2' }
pipsBetween(ask, bid, 'EUR/USD');  // the spread in pips, to a tenth
fxMarketOpen(new Date());          // Sunday 17:00 to Friday 17:00, New York time
fxCentresOpen(new Date());         // e.g. ['London', 'New York']: the overlap

const bidColumn: ColumnDef = {
  type: 'custom', key: 'bid', header: 'Bid',
  render: ({ row }) => fxQuoteHtml(Number(row.bid), String(row.pair)), // big figure, pips, pipette
};
```

- Pass a pip size below 1 instead of a pair for metals, currencies with another pip (HUF, KRW) or a broker's own convention.
- `fxQuoteHtml` puts each part in a class of its own (`bo-fx-big`, `bo-fx-pips`, `bo-fx-pipette`) with inline defaults you can override.
- The centres are Sydney, Tokyo, London and New York in their own business hours, so summer time moves them as it does on the street.

## Crypto

The crypto market never closes: `sessionStateAt(now, CRYPTO_SCHEDULE, { timeZone: 'UTC', skipWeekends: false })` always reads `'continuous'`. One watchlist runs from 63,250 down to 0.0000012, where no fixed number of decimals suits every row:

```ts
import { fmtSigPrice, fmtTradingPrice, roundToTick } from 'bo-grid/trading';

fmtSigPrice(63_250.42);      // '63,250': five significant digits, and every digit of the integer part
fmtSigPrice(0.0000123456);   // '0.000012346'
fmtTradingPrice(0.5123, 0.0001); // where you know the symbol's tick, show it exactly
roundToTick(0.12345, 0.001, 'down'); // a size rounded down to its lot step
```

## Basis points and 32nds

`fmtBps(fraction)` shows a fraction in basis points: pass `(ask - bid) / mid` for a spread, or `(y1 - y0) / 100` for a move in a yield quoted in percent. Treasuries are quoted as a whole number and 32nds; `fmtFraction` writes them and `parseFraction` reads them back, so a price column can be edited the way it is quoted:

```ts
import { fmtBps, fmtFraction, parseFraction } from 'bo-grid/trading';

fmtBps(0.00125);                                          // '12.5 bp'
fmtBps(-0.0005, { sign: true });                          // '-5.0 bp'; unit: '' when the header says bp
fmtFraction(99.515625, { sub: 2 });                       // '99-16+': 99 and 16½ 32nds
fmtFraction(99.5078125, { sub: 4 });                      // '99-162': quarters as 2, + and 6
fmtFraction(99.5078125, { sub: 4, style: 'futures' });    // "99'162": quarters as 2, 5 and 7
fmtFraction(450.25, { denominator: 8, separator: "'" });  // "450'2": a grain price in eighths

const quote = { sub: 2 } as const;
const px: ColumnDef = {
  type: 'number', key: 'px', header: 'Price', editable: true,
  format: (v) => fmtFraction(Number(v), quote),
  parse: (raw) => parseFraction(raw, quote), // '99-16+' or 99.515625; anything else is refused
};
```

Cash Treasuries write the last character in eighths of a 32nd (`+` for the half), while futures screens write its first decimal digit (`5` for the half), so `'99-165'` and `"99'165"` are different prices. Give `parseFraction` the same options the column formats with, so an order is never entered at the other one.

## The full boards

A HOSE board with price-limit colours, tick-aware formatting and a live session badge, fed through `bo-grid/realtime`:

<Example id="vnboard" />

FX pairs on a dealing-screen quote, and a crypto watchlist with alerts:

<Example id="fxcrypto" />

## Reference

| Function | What it returns |
| --- | --- |
| `vnBands(ref, exchange?)` | `{ ref, ceiling, floor }` for HOSE (default), HNX or UPCOM, tick-rounded. |
| `vnFuturesBands(ref)` | The VN30 futures band (`VN_FUTURES_BAND`, ±7%) on its 0.1 step (`VN_FUTURES_TICK`). |
| `vnTickSize(price, exchange?)` | The price step at this price. |
| `vnBandPercent(exchange)` | The daily band as a fraction: 0.07, 0.1 or 0.15. |
| `roundToTick(price, tick, mode?)` | The price on the tick: `'nearest'` (default), `'down'` or `'up'`. |
| `resolveTone(price, bands, opts?)` | The tone: `'ceiling'`, `'floor'`, `'ref'`, `'up'` or `'down'`. |
| `toneColor(tone, colours?)` | A CSS colour; `darkToneColors` (also `defaultToneColors`) unless given a palette. |
| `fmtTradingPrice(price, tick, locale?)` | The price with its tick's decimals, grouped. |
| `decimalsForTick(tick)` | The decimals a tick needs. |
| `sessionStateAt(date, schedule, opts?)` | The session state; `opts`: `timeZone`, `skipWeekends`. |
| `sessionLabel(state)` | A display label for a state. |
| `fxPipSize(pair)` | 0.01 for yen-quoted pairs, else 0.0001. |
| `fxQuoteParts(price, pip, opts?)` | `{ big, pips, pipette }`; `pipette: false` stops at the pip. |
| `fxQuoteHtml(price, pip, opts?)` | The same parts as HTML. |
| `pipsBetween(a, b, pip)` | `a - b` in pips, to a tenth. |
| `fxMarketOpen(date)` | Whether the FX week is open. |
| `fxCentresOpen(date)` | The centres in business hours. |
| `fmtSigPrice(price, digits?, locale?)` | The price to 5 (or `digits`) significant digits. |
| `fmtBps(fraction, opts?)` | Basis points; `opts`: `decimals`, `sign`, `unit`, `locale`. |
| `fmtFraction(price, opts?)` | A whole number and parts; `opts`: `denominator`, `sub`, `style`, `separator`. |
| `parseFraction(text, opts?)` | The price a fraction or a decimal means; `NaN` for anything else, which refuses an edit. |

Positions from fills (`createPositions`, `unrealizedPnl`) are on [Orders & positions](../orders-positions/).
