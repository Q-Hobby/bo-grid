---
title: Orders & positions
description: An order blotter with status chips, new orders that flash, done orders that linger a moment (createLinger), and positions with realized and unrealized P&L from the fills (createPositions).
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

An order blotter lists working orders as they arrive, change and complete. It needs a few things beyond the grid itself. Status chips are a `badge` column. A new order flashes once with `flashNewRows`, and footer totals follow the feed. Two helpers cover the rest: `createLinger` keeps a done order on screen a moment, so it does not vanish from under the eye, and `createPositions` keeps each symbol's position from the fills.

New orders below flash as they arrive. A filled order stays 1.5 seconds, dimmed, before it leaves, and each fill moves the position above the grid.

<Example name="orders-positions" title="Orders and a position" />

## The blotter

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'symbol', header: 'Symbol' },
  { type: 'badge', key: 'side', header: 'Side', tones: { buy: 'up', sell: 'down' } },
  { type: 'number', key: 'qty', header: 'Qty', groupAgg: 'sum' },
  { type: 'badge', key: 'status', header: 'Status', tones: { Working: 'info', Filled: 'up', Cancelled: 'neutral' } },
];
```

```svelte
<Grid rows={shown} {columns} {rowClass} footer flashNewRows height={480} />
```

- A `badge` column maps each value to a tone: `'up'`, `'down'`, `'amber'`, `'info'` or `'neutral'`.
- `flashNewRows` flashes a row once when its id is new: an order that arrived, not one that changed. See [Live updates](../realtime/#stale-and-new-rows).
- `footer` shows a totals row; each column with a `groupAgg` shows that aggregate over all rows, and it stays live as orders change.

## Orders that linger

When an order completes and leaves your list, `createLinger` keeps it on screen for `ms` more, in place, so nothing else moves until it goes:

```ts
import { createLinger } from 'bo-grid/realtime';

let expired = $state(0);
const linger = createLinger<GridRow, number>({ ms: 1500, key: (o) => o.id, onExpire: () => expired++ });
const shown = $derived.by(() => {
  void expired; // updates again when a row is due to go
  return linger.update(orders); // the orders, plus the ones that just left, in place
});
const rowClass = $derived.by(() => {
  void shown; // a new function per update, so the grid restyles the rows leaving
  return (o: GridRow) => (linger.leaving(o) ? 'leaving' : undefined);
});
```

- `update(rows)` returns the rows you give it, plus those that left within `ms`, each right after the row it followed. A row that comes back is simply there again.
- `onExpire` runs when a lingering row is due to go: call `update` again (above, by bumping `expired`).
- Keys must be unique. `leaving(row)` compares the row object as `update` returned it.
- To show an order as Filled while it lingers, mark it Filled first and drop it from your list on the next update: it lingers as it was last shown.
- Rows on their way out count in footer totals like any other. `stop()` drops them and the pending `onExpire`.

## Positions from fills

```ts
import { createPositions, unrealizedPnl } from 'bo-grid/trading';

const book = createPositions();
book.fill({ symbol: 'FPT', side: 'buy', qty: 400, price: 11.5 });
book.fill({ symbol: 'FPT', side: 'sell', qty: 100, price: 13 }); // realizes 150
const p = book.get('FPT'); // { symbol: 'FPT', qty: 300, avgPrice: 11.5, realized: 150, bought: 400, sold: 100 }
if (p) unrealizedPnl(p, 12); // 150: the open 300 marked at 12
```

- Each fill moves the symbol's position on average cost. A fill against the position realizes P&L on the part it closes, at the average price. One that goes through flat opens the rest on the other side, at the fill price.
- `fee` comes off realized P&L; a negative fee (a rebate) adds to it.
- Fractional sizes that add up to flat are flat, with no dust left open.
- A fill with an empty symbol, a side other than `'buy'` or `'sell'`, a quantity not above 0, or a price or fee that is not a number throws, so a bad feed message is seen rather than booked.
- `all()` lists every position, and `clear()` empties the book.

**Live P&L.** Keep the last price as a field of each position row and compute unrealized P&L in a computed column. It depends only on its own row, so a `groupAgg: 'sum'` footer follows every tick:

```ts
{ type: 'number', key: 'upnl', header: 'Unrealized', groupAgg: 'sum',
  value: (r) => unrealizedPnl({ qty: Number(r.qty), avgPrice: Number(r.avgPrice) }, Number(r.last)) }
```

The full blotter: orders with status chips, cancel on C, and positions with live P&L:

<Example id="orders" />

## Reference

<Props names={['flashNewRows', 'footer', 'rowClass']} />

<Props of="column" names={['groupAgg', 'value']} />

`createLinger<R, K>({ ms, key, onExpire? })` returns `{ update(rows), leaving(row), size, stop() }`.

`createPositions()` returns `{ fill(f), get(symbol), all(), clear() }`; a fill is `{ symbol, side, qty, price, fee? }`, and a position is `{ symbol, qty, avgPrice, realized, bought, sold }` (`qty` below 0 when short). `unrealizedPnl(position, last)` marks the open quantity at `last`.
