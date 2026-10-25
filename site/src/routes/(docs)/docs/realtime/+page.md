---
title: Live updates
description: Stream a market feed into the grid — plain rows patched in place, one batch a frame, with rows that keep their sort, go stale when a feed goes quiet and flash when they arrive.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

bo-grid is built for screens whose values change many times a second: price boards, watchlists, blotters. Values change in place, and the grid repaints only the cells that changed, flashing each one. Updates can reach the grid two ways. Write into `$state` rows, which is the simplest. For a busy feed, keep the rows as plain objects and hand the grid a batch of patches once a frame.

This board takes 40 ticks a second through a tick stream into `api.patchRows`. It is sorted by change and stays sorted as prices move. Rows hold still while the pointer is over them.

<Example name="realtime" title="A live board" />

## Two ways to update rows

**`$state` rows.** Make the rows deep state and assign the new value. The grid sees the write and repaints that cell. A column with `flash: 'auto'` flashes it green or red (see [Cell flashing](../flashing/)):

```svelte
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  let rows = $state(initialQuotes);
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'price', key: 'price', header: 'Price', flash: 'auto' },
  ];
  socket.onmessage = (e) => {
    const q = JSON.parse(e.data);
    const row = rows.find((r) => r.symbol === q.symbol);
    if (row) row.price = q.price; // the cell repaints and flashes
  };
</script>

<Grid {rows} {columns} height={480} />
```

This works well for a few hundred writes a second. Every field write goes through a reactive proxy, paid for every row the feed touches, on screen or not.

**Plain rows and `api.patchRows`.** For a full price board (hundreds to thousands of symbols, several fields a tick), give the grid plain objects and let it write the ticks. A [tick stream](../tick-stream/) coalesces the messages per key and hands the grid one batch a frame:

```svelte
<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';

  let rows = $state.raw(initialQuotes); // plain objects: no deep proxy
  let api: GridApi | undefined;
  const stream = createTickStream<string, Partial<Quote>>({
    apply: (batch) => api?.patchRows(batch), // writes in place, repaints rendered cells only
  });
  stream.start();
  socket.onmessage = (e) => {
    const q = JSON.parse(e.data);
    stream.push(q.symbol, q);
  };
</script>

<Grid {rows} {columns} getRowId={(r) => String(r.symbol)} onReady={(a) => (api = a)} height={480} />
```

A patch is `[rowId, fields]`, where the id is the grid's `getRowId` (`row.id` by default). `patchRows` returns how many rows changed. Past about 10,000 messages a second, read the socket in a worker instead: see [Worker feeds](../worker-feed/).

## What repaints

`patchRows` writes into the rows and repaints only the rendered cells whose field changed. A tick that moves the price and the volume repaints those two cells, not the row. Rows off screen pay nothing beyond the write, and show the current values when they scroll in. Footer totals, group subtotals and selection sums stay live.

Some cells can read other fields of the row, so they repaint whenever the row changes:

- renderers: `render`, `component` and the `cell` snippet;
- computed columns (`value`) and `sub` fields;
- any `format`, `cellClass` or `tooltip` function that declares the row parameter.

Write `(value, row) => …` only when the function reads the row, and `(value) => …` otherwise, so the cell skips ticks that don't concern it.

`component` cells and the `cell` snippet update in place. On each patch they receive a fresh view of the row (same fields, new identity), so their markup and `$derived` values re-run while the component, its DOM and its local state stay. Read `row` reactively, not once at mount.

## Keeping the sort current

Values that change in place do not re-sort or re-filter the view on every tick. For a board whose order must follow the feed (top movers, a watchlist sorted by change), set `liveSort`:

```svelte
<Grid {rows} {columns} sort={[{ key: 'change', dir: 'desc' }]} liveSort={500} onReady={(a) => (api = a)} height={480} />
```

When a patch changes a field the grid sorts or filters by, the rows it changed are merged back into place at most every `liveSort` ms (`true` means 500). Only those rows are sorted and merged into the rest: on 100,000 rows with 500 changed, that takes about 5 ms against about 21 ms for a full re-sort. A row that changes other fields queues nothing.

- Rows that stop matching a filter leave; rows that start matching join; a row whose group field changed moves to its new group.
- The focused cell stays on its row as the row moves.
- Nothing moves while a cell is being edited, or while the pointer is over the rows (`pauseOnHover`, on by default, for mouse and pen). Leaving the rows, the window losing focus or the tab hiding ends the pause.

`liveSort` follows `patchRows`. Without it, or for values written into rows any other way, call `api.refresh()` to re-filter and re-sort the whole view against the current values. A row that keeps its position keeps its rendered cells.

## Stale and new rows

- **`staleAfter`** (ms) dims a row when nothing new has come for it in that long: a quote whose feed went quiet. The row comes back the moment it ticks. News is a `patchRows` that changed the row, or a new object for it in `rows`; a patch that re-sends the same values is not news. Style it with `--bo-stale-opacity` (default 0.5).
- **`flashNewRows`** flashes a row once when it arrives in `rows`, such as a new order or a new fill (`true` means 600 ms; or a number of ms). A row arrives when its id is new. A copy of a row already there does not flash, nor do the rows an empty grid receives (a load), nor a wholesale replacement.

```svelte
<Grid {rows} {columns} liveSort staleAfter={5000} flashNewRows onReady={(a) => (api = a)} height={480} />
```

## Busy screens

The cost of a frame grows with the rows on screen, roughly linearly: on the Price board, 80 rows cost about 2.5 times what 30 do. Three settings keep a busy board inside its frame budget:

- **The stream's `cap`** bounds the patches applied in one frame (400 by default). Ticks beyond it wait for the next frame instead of stretching this one.
- **`flashMotion="hold"`** replaces the fading flash with a held tint, about 3 to 4 times less main-thread work under a busy feed. See [Cell flashing](../flashing/#busy-boards).
- **`updateMs`** on a column repaints it at most that often. Every tick is still written into the row at once, so sort, filters, totals and the other columns see it; the cell shows the latest value on its next beat. Use it for values read at a glance that change on every trade (total volume, foreign buy and sell), so they stop repainting every frame while the prices stay instant:

```ts
{ type: 'number', key: 'tv', header: 'Total vol', updateMs: 250 }
```

The first change after a quiet spell shows at once, and a flash plays on the repaint, against the value shown before.

## Measured

On the Price board example (production build, 1,000 symbols, 24 columns, every changed cell flashing, about 30 rows on screen), a frame of a 30,000 events/s feed costs about 4.5 ms (p50) with `patchRows`, against about 5.3 ms through `$state` rows. The writes themselves are about 2.7 times cheaper (0.6 against 1.6 ms), and the gap grows with the number of symbols and fields a tick. The method and the full tables are in [BENCHMARKS.md](https://github.com/bonguynvan/bo-grid/blob/main/BENCHMARKS.md#browser-a-busy-price-board); the board's Benchmark button measures your machine.

The full board, with three bid and ask levels, foreign flow and price-limit colours:

<Example id="priceboard" />

## Reference

<Props names={['liveSort', 'pauseOnHover', 'staleAfter', 'flashNewRows', 'getRowId', 'onReady']} />

<Props of="column" names={['updateMs']} />

<Props of="api" names={['patchRows', 'refresh']} />
