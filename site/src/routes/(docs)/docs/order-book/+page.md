---
title: Order book
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

`createOrderBook` keeps a book from a depth feed: a snapshot, then the levels
that change (a size of 0 removes one). It reads back the best levels a side,
merged into price buckets on request, and as rows for the grid:

```ts
import { createOrderBook } from 'bo-grid/realtime';

const book = createOrderBook({ maxLevels: 1000 });
book.snapshot({ bids, asks, seq: snap.lastUpdateId });      // e.g. from REST
socket.onmessage = (m) => {
  // [price, size] levels, as numbers or numeric strings; size 0 removes one.
  const result = book.update({ bids: m.b, asks: m.a, from: m.U, seq: m.u });
  if (result === 'gap') resnapshot();                        // a message was missed
};

// Once a frame, not once a message:
if (book.version !== seen) {
  seen = book.version;
  rows = book.rows(20, { group: 0.5 });  // stacked: asks above bids
  // or book.pairs(20) for a side-by-side book, book.top(20) for the levels
}
```

```svelte
<Grid {rows} rowClass={(r) => r.side} columns={[
  { type: 'number', key: 'price', header: 'Price' },
  { type: 'volume', key: 'size', header: 'Size', flash: 'auto' },
  { type: 'custom', key: 'total', header: 'Depth' }, // a bar of width r.share
]} />
```

- **Updates** apply as they arrive: on a 5,000-level book, a 40-level message
  takes about 5 µs when its levels are near the spread (where a feed's changes
  mostly are) and about 50 µs when they land anywhere in the book. The book is
  read when a frame draws: `version` bumps on every change a read can see, so
  an unchanged book costs nothing.
- **`seq`** is the update's (last) sequence number: one that is not newer
  than the last applied is dropped as `'stale'`, as a feed's diffs from before
  the snapshot must be. **`from`** is the first number it covers, for a feed
  that numbers its updates in an unbroken run: past the one after the last
  applied, `update` returns `'gap'` and applies nothing, so take a new
  snapshot. Without `from`, a missed update goes unnoticed unless it crosses
  the book: `crossed` turns true when the best bid reaches the best ask.
  `snapshot` always replaces the book.
- **`group`** merges levels into buckets (bids rounded down, asks up, so the
  sides never meet in one): 0.1, 1, 10 on a crypto book.
- **Rows** carry `size`, `total` (depth from the spread outward) and `share`
  (that depth as a share of the deeper side, for a bar on one scale). A
  level keeps its row id while it stays in the book, so a size column with
  `flash: 'auto'` flashes the levels that changed, not every row the book
  moved past. Each grouping has ids of its own, so switching it flashes
  nothing. `pairs` rows put the nth bid beside the nth ask (`bidPrice`,
  `bidSize`, ..., `askShare`) with the depth as the id, so a row's level
  changes as the book moves: don't flash those columns by value.
- **`maxLevels`** reads a side's best levels only and drops the far ones (in
  batches), for a feed that never removes them. A dropped level comes back
  only with the next snapshot, so keep it well above the depth you show.
- **Prices** compare to 1e-8, as `DepthLadder`'s do: scale a book quoted
  finer than that.

The same levels feed `DepthLadder` (`bids={top.bids} asks={top.asks}`). See the
**Order book** demo.

## Live example

<Example id="orderbook" />
