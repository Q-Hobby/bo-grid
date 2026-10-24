---
title: Orders & positions
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

An order blotter needs a few things beyond the grid itself. Status chips are
a `badge` column (`tones: { Working: 'info', Filled: 'up', … }`), a new order
flashes once with `flashNewRows`, and running footer totals follow the feed.
Two helpers cover the rest:

```ts
import { createLinger } from 'bo-grid/realtime';
import { createPositions, unrealizedPnl } from 'bo-grid/trading';

// A done order stays a moment, dimmed, instead of vanishing from under the eye.
let expired = $state(0);
const linger = createLinger({ ms: 1500, key: (o) => o.id, onExpire: () => expired++ });
const shown = $derived.by(() => {
  void expired; // updates again when a row is due to go
  return linger.update(orders); // the orders, plus the ones that just left, in place
});
const rowClass = $derived.by(() => {
  void shown; // a new function per update, so the grid restyles the rows leaving
  return (o) => (linger.leaving(o) ? 'leaving' : undefined);
});

// Positions on average cost, from the fills.
const book = createPositions();
book.fill({ symbol: 'FPT', side: 'buy', qty: 400, price: 11.5 });
book.fill({ symbol: 'FPT', side: 'sell', qty: 100, price: 13 }); // realizes 150
const p = book.get('FPT'); // { qty: 300, avgPrice: 11.5, realized: 150, bought: 400, sold: 100 }
unrealizedPnl(p, 12); // 150: the open 300 marked at 12
```

- **`createLinger`** returns the rows you give it plus those that left within
  `ms`, each right after the row it followed, so nothing else moves until it
  goes. A row that comes back is simply there again. Keys must be unique, and
  `leaving` compares the row object as `update` returned it. To show an order as
  Filled while it lingers, mark it Filled first and drop it from your list on
  the next update: it lingers as it was last shown. Rows on their way out
  count in footer totals like any other.
- **`createPositions`** moves a symbol's position with each fill. A fill
  against the position realizes P&L on the part it closes, at the average
  price; one that goes through flat opens the rest on the other side at the
  fill price; `fee` comes off realized P&L (a negative fee, a rebate, adds to
  it). Fractional sizes that add up to flat are flat, with no dust left open.
  A fill with an empty symbol, a side other than `'buy'` or `'sell'`, a
  quantity not above 0, or a price or fee that is not a number throws, so a
  bad feed message is seen rather than booked.
- **Live P&L:** keep the last price as a field of each position row and
  compute unrealized P&L in a `value` column (`(r) => unrealizedPnl(r, r.last)`).
  It depends only on its own row, so a `groupAgg: 'sum'` footer follows every
  tick through the running totals.

See the **Orders & positions** demo for all of it together.

## Live example

<Example id="orders" />
