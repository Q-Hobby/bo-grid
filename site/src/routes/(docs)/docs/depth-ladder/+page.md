---
title: Depth ladder
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

`DepthLadder` is a price ladder (depth of market) built on the grid: one row
per price on the tick grid, highest first, with the bid and ask sizes, their
depth from the best price outward as bars, and your own working orders beside
each side. It is a separate entry (~4 KB gzip on top of the grid).

```svelte
<script lang="ts">
  import { DepthLadder, type LadderAction } from 'bo-grid/ladder';
  import { vnTickSize } from 'bo-grid/trading';

  let { bids, asks, last, orders } = $props(); // from your feed and order store
  let following = $state(true);

  function onAction(a: LadderAction) {
    if (a.kind === 'cancel') venue.cancel(a.orders.map((o) => o.id));
    else venue.place({ side: a.kind, price: a.price, qty: ticket.qty });
  }
</script>

<DepthLadder {bids} {asks} {last} {orders} tick={(p) => vnTickSize(p, 'HOSE')} bind:following {onAction} />
```

- **The book:** `bids` and `asks` are `[price, size]` pairs, in any order. A
  price that repeats is summed, and float noise in a feed still meets its
  level. `tick` is one size or a function of the price for a tick table; the
  step down from a band's first price uses the band below.
- **Following the market:** the window centres on the middle of the spread
  (`center="last"` follows the last trade) and recentres only once the market
  leaves the middle half of the window, so the rows sit still between moves.
  It never moves while the pointer is over it or a cell has focus, so a price
  cannot shift under a click or a key.
- **Paging:** the wheel pages through prices and turns `following` off (bind
  it to see that); Space, setting `following` back to `true`, or `recenter()`
  (via `bind:this`) centres on the market again. A click focuses the ladder
  without holding it once the pointer leaves; the keyboard working in it does
  hold it.
- **Order entry is yours:** `onAction` hears what the user asked for. A click
  on the bid side is `'buy'` at that row's price, on the ask side `'sell'`, on
  your orders `'cancel'` with them; B, S and Delete do the same on the focused
  row, once per press (a held key does not repeat it). Each action carries
  the price of the row as it was shown. The ladder places nothing itself:
  show an order once your venue acknowledges it.
- **Looks:** ask prices in the down colour, bid prices in the up colour, the
  best bid and ask in bold, the last trade tinted, and the depth bars of both
  sides on one scale, so a lopsided book looks lopsided. `rows`, `rowHeight`,
  `format`, `locale`, `headers` and `theme` adjust it.

The helpers behind it (`ladderPrices`, `ladderRows`, `midPrice`, `stepPrice`
and more) are exported too, for a ladder of a different shape.

## Price ladder & time & sales

Two more pieces of `bo-grid/realtime` for the surfaces every trading desk
needs, both pure: the windowing math for a ladder of your own (`DepthLadder`
above is the ready-made one), and a trade tape:

```ts
import { centeredWindow } from 'bo-grid/realtime';

// 120 price levels, 16 visible, centred on the spread (index 60):
const { start, end } = centeredWindow(120, 60, 16); // { start: 52, end: 68 }
const visible = levels.slice(start, end);           // hand THIS to <Grid rows>
```

A ladder shows more levels than fit on screen, kept centred on the spread as
the book moves. `centeredWindow` is the windowing math — feed the grid a
different slice of the same levels array each tick instead of fighting virtual
scroll to physically scroll to a position. "Scroll-lock" (follow the market vs.
hold position because the viewer paged away) is UI state you keep yourself —
see the **Price ladder** demo for the pattern (a `lockedCenter: number | null`:
`null` follows live, a number freezes the window until "Recenter").

```ts
import { TradeTape } from 'bo-grid/realtime';

const tape = new TradeTape<Trade>(500); // capped ring buffer, O(1) per push
socket.onmessage = (e) => tape.push(JSON.parse(e.data));
rows = tape.toArray(); // newest trade first — call once per render, not per trade
```

A time & sales tape is the opposite discipline from a price feed: nothing
coalesces (every trade must show), so what it needs is a bound instead — drop
the oldest trade once `capacity` is reached, O(1) regardless of session length.
See the **Time & sales** demo.

## Live example

<Example id="ladder" />

<Example id="timesales" />
