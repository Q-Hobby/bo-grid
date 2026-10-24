---
title: Order book
description: Keep an order book from a depth feed with createOrderBook — snapshot, incremental updates with sequence checks, grouping — and show it as stacked or side-by-side grid rows.
---

<script>
  import Example from '$lib/Example.svelte';
</script>

A depth feed sends a snapshot of the book, then the price levels that change. `createOrderBook` from `bo-grid/realtime` keeps that book: it applies the changes as they arrive, checks their sequence numbers, and reads back the best levels a side when a frame draws, merged into price buckets on request and shaped as rows for the grid.

The book below is read once a frame. Sizes flash as levels change, the depth bars show the running total from the spread outward, and Group merges levels into buckets.

<Example name="order-book" title="An order book" />

## Keeping the book

```ts
import { createOrderBook } from 'bo-grid/realtime';

const book = createOrderBook({ maxLevels: 1000 });
book.snapshot({ bids, asks, seq: snap.lastUpdateId }); // e.g. from REST

socket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  // [price, size] levels, as numbers or numeric strings; a size of 0 removes a level
  const result = book.update({ bids: m.b, asks: m.a, from: m.U, seq: m.u });
  if (result === 'gap') resnapshot(); // a message was missed
};
```

`update` returns `'applied'`, `'stale'` or `'gap'`:

- **`seq`** is the update's last sequence number. An update that is not newer than the last one applied is dropped as `'stale'`, as a feed's diffs from before the snapshot must be.
- **`from`** is the first sequence number the update covers, for a feed that numbers its updates in an unbroken run. When it is past the one after the last applied, `update` returns `'gap'` and applies nothing: take a new snapshot.
- Without `from`, a missed update goes unnoticed unless it crosses the book: `crossed` turns true when the best bid reaches the best ask.
- `snapshot` always replaces the whole book, whatever its `seq`. `clear()` empties it and forgets the sequence.

## Reading it once a frame

Apply updates as they arrive, and read the book when a frame draws. `version` bumps on every change a read can see, so an unchanged book costs nothing:

```ts
let seen = -1;
function frame() {
  if (book.version !== seen) {
    seen = book.version;
    rows = book.rows(20, { group: 0.5 }); // stacked: asks above bids
  }
  requestAnimationFrame(frame);
}
```

Three reads, each up to `n` levels a side:

- **`rows(n)`**: stacked rows, the asks (farthest first) above the bids, each with `side`, `price`, `size`, `total` (depth from the spread outward), `share` (that depth as a share of the deeper side, for bars on one scale) and `best`.
- **`pairs(n)`**: the nth bid beside the nth ask in one row (`bidPrice`, `bidSize`, `bidTotal`, `bidShare`, then the same for the ask), for a side-by-side book.
- **`top(n)`**: the levels themselves, `{ bids, asks }` as `[price, size]` pairs, best first. The same levels feed a [depth ladder](../depth-ladder/): `bids={top.bids} asks={top.asks}`.

`best()` gives the best bid and ask, and `levels` counts each side.

## Showing it in the grid

```svelte
<Grid {rows} rowClass={(r) => String(r.side)} columns={[
  { type: 'number', key: 'price', header: 'Price' },
  { type: 'volume', key: 'size', header: 'Size', flash: 'auto' },
  { type: 'number', key: 'share', header: 'Depth', format: (_v, r) => String(r?.total ?? ''), dataBar: { min: 0, max: 1 } },
]} height={480} />
```

- In `rows`, a level keeps its row id while it stays in the book, so a size column with `flash: 'auto'` flashes the levels that changed, not every row the book moved past. Each grouping has ids of its own, so switching it flashes nothing.
- In `pairs`, the row id is the depth (0 at the spread), so a row's level changes as the book moves: don't flash those columns by value.
- A `dataBar` on `share` with `min: 0, max: 1` draws the depth bars of both sides on one scale.

## Options

- **`group`** (a read option) merges levels into buckets of that size: 0.1, 1 or 10 on a crypto book. Bids round down and asks up, so the two sides never meet in one bucket.
- **`maxLevels`** keeps only a side's best levels and drops the far ones, in batches, for a feed that never removes them. A dropped level comes back only with the next snapshot, so keep it well above the depth you show.
- Prices compare to 1e-8, as the depth ladder's do: scale a book quoted finer than that.

The order book example, with a stacked and a side-by-side book from one feed:

<Example id="orderbook" />

## Reference

`createOrderBook(options?)` returns an `OrderBook`. Its option is `maxLevels` (read at most this many levels a side).

| Member | What it does |
| --- | --- |
| `snapshot({ bids, asks, seq? })` | Replaces the whole book. |
| `update({ bids?, asks?, seq?, from? })` | Applies changed levels; returns `'applied'`, `'stale'` or `'gap'`. |
| `rows(n, { group? })` | Stacked rows (`BookRow`): asks, then bids. |
| `pairs(n, { group? })` | Side-by-side rows (`BookPairRow`). |
| `top(n, { group? })` | `{ bids, asks }`, best first. |
| `best()` | `{ bid?, ask? }`. |
| `crossed` | Whether the best bid is at or above the best ask. |
| `levels` | `{ bids, asks }`: levels a side. |
| `version` | Bumps on every change a read can see. |
| `seq` | The last sequence number applied. |
| `clear()` | Empties the book. |
