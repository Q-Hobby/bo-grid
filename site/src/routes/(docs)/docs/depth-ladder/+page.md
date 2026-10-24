---
title: Depth ladder
description: A price ladder with click-to-trade (DepthLadder), the windowing math for a ladder of your own, and a capped time and sales tape.
---

<script>
  import Example from '$lib/Example.svelte';
</script>

A depth ladder (depth of market) shows one row per price on the tick grid, highest first, with the bid and ask sizes resting at each price, their depth from the best price outward, and your own working orders beside each side. A trader clicks a price to place an order there. `DepthLadder` from `bo-grid/ladder` is that ladder, built on the grid. It is a separate entry, so an app pays for it only when it imports it.

Try it below: click a bid size to buy at that price, an ask size to sell, your own order to cancel it. With a row focused, B, S and Delete do the same. The wheel pages through prices and stops the ladder following the market; Space recentres it.

<Example name="depth-ladder" title="A depth ladder" />

## Using DepthLadder

```svelte
<script lang="ts">
  import { DepthLadder, type LadderAction } from 'bo-grid/ladder';
  import { vnTickSize } from 'bo-grid/trading';

  let { bids, asks, last, orders } = $props(); // from your feed and your order store
  let following = $state(true);

  function onAction(a: LadderAction) {
    if (a.kind === 'cancel') venue.cancel(a.orders.map((o) => o.id));
    else venue.place({ side: a.kind, price: a.price, qty: ticket.qty });
  }
</script>

<DepthLadder {bids} {asks} {last} {orders} tick={(p) => vnTickSize(p, 'HOSE')} bind:following {onAction} />
```

- **The book.** `bids` and `asks` are `[price, size]` pairs in any order; an [order book](../order-book/)'s `top(n)` gives them. A price that repeats is summed, and float noise in a feed still meets its level. `tick` is one step size, or a function of the price for a tick table; the step down from a band's first price uses the band below.
- **Your orders.** `orders` are `{ id, side, price, qty }`, summed per price beside their side.
- **Looks.** Ask prices in the down colour, bid prices in the up colour, the best bid and ask in bold, the last trade's row tinted, and the depth bars of both sides on one scale, so a lopsided book looks lopsided. `rows`, `rowHeight`, `format`, `locale`, `headers` and `theme` adjust it.

## Following the market

The window centres on the middle of the spread (`center="last"` follows the last trade). It recentres only once the market leaves the middle half of the window, so the rows sit still between moves. It never moves while the pointer is over it or a cell has focus, so a price cannot shift under a click or a key.

The wheel pages through prices and turns `following` off; bind it to show that state. Space, setting `following` back to `true`, or calling `recenter()` (through `bind:this`) centres on the market again. A click focuses the ladder without holding it once the pointer leaves; keyboard work in it does hold it.

## Order entry

The ladder places nothing itself: `onAction` hears what the user asked for, and your app talks to the venue.

- A click on the bid side is `{ kind: 'buy', price }`, on the ask side `{ kind: 'sell', price }`, and on your own orders `{ kind: 'cancel', price, side, orders }`.
- B, S and Delete do the same on the focused row, once per press: a held key does not repeat it. Delete cancels your orders on both sides of the price.
- Each action carries the price of the row as it was shown, and `via: 'click' | 'key'`.

Show an order on the ladder once your venue acknowledges it.

## A ladder of your own

The helpers behind `DepthLadder` are exported from `bo-grid/ladder` for a ladder of another shape: `ladderPrices(center, count, tick)`, `ladderRows(prices, input)`, `midPrice`, `bestPrices`, `ordersAt`, `snapToTick` and `stepPrice`.

For a ladder drawn with `<Grid>` directly, `centeredWindow` from `bo-grid/realtime` is the windowing math: hand the grid a different slice of the same levels each tick, instead of scrolling a long list to a position.

```ts
import { centeredWindow } from 'bo-grid/realtime';

// 120 price levels, 16 visible, centred on the spread (index 60):
const { start, end } = centeredWindow(120, 60, 16); // { start: 52, end: 68 }
const visible = levels.slice(start, end);           // the rows for <Grid>
```

Following the market or holding still is state you keep yourself: a `lockedCenter: number | null`, where `null` follows the live centre and a number freezes the window until the user recentres. The price ladder example below shows the pattern:

<Example id="ladder" />

## Time and sales

A time and sales tape is the opposite of a price feed: nothing coalesces, because every trade must show. What it needs is a bound. `TradeTape` from `bo-grid/realtime` is a ring buffer that keeps the newest `capacity` trades (500 by default), O(1) per push however long the session runs:

```ts
import { TradeTape } from 'bo-grid/realtime';

const tape = new TradeTape<Trade>(500);
socket.onmessage = (e) => tape.push(JSON.parse(e.data));
rows = tape.toArray(); // newest first: call it once a frame, not once a trade
```

`toArray()` returns a fresh array, newest trade first; `size` counts the trades held and `clear()` empties the tape. In the hot-path benchmarks, a million pushes into a 500-trade tape take about 9 ms ([BENCHMARKS.md](https://github.com/bonguynvan/bo-grid/blob/main/BENCHMARKS.md#hot-paths)).

<Example id="timesales" />

## Reference

`<DepthLadder>` props:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `bids`, `asks` | `[price, size][]` | required | Resting levels, in any order. |
| `tick` | `number`, or `(price) => number` | required | The price step, or a function of the price. |
| `last` | `number` | none | The last trade's price: its row is marked. |
| `orders` | `LadderOrder[]` | `[]` | Your working orders. |
| `rows` | `number` | `21` | Prices on screen. |
| `rowHeight` | `number` | `24` | Row height in px. |
| `center` | `'mid'` or `'last'` | `'mid'` | What the ladder follows. |
| `following` | `boolean` (bindable) | `true` | Whether it follows the market. |
| `format` | `(price) => string` | the tick's decimals | Formats a price. |
| `locale` | `string` | `'en-US'` | Locale for the default formats. |
| `headers` | `LadderHeaders` | none | Column headers: `myBid`, `bid`, `price`, `ask`, `myAsk`. |
| `onAction` | `(action, event) => void` | none | A buy, sell or cancel the user asked for. |
| `theme` | `'dark'`, `'light'` or a `GridTheme` | as on `<Grid>` | The grid theme. |
| `ariaLabel` | `string` | `'Price ladder'` | Accessible name. |

`TradeTape<T>(capacity?)`: `push(trade)`, `toArray()`, `size`, `capacity`, `clear()`. `centeredWindow(total, center, visible)`: `{ start, end }`.
