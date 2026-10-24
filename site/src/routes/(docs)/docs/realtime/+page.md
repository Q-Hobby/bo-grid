---
title: Live updates
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

## Busy markets

`$state` rows are the simplest model, but every field write goes through a
reactive proxy, paid for **every** row the feed touches, on screen or not. For a
full price board (hundreds to thousands of symbols, several fields per tick)
hand the grid **plain objects** and let it write the ticks:

```svelte
<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';

  let rows = $state.raw(initialQuotes); // plain objects — no deep proxy
  let api: GridApi;
  const stream = createTickStream<string, Partial<Quote>>({
    apply: (batch) => api.patchRows(batch), // writes in place, repaints rendered rows only
  });
  stream.start();
  socket.onmessage = (e) => { const q = JSON.parse(e.data); stream.push(q.symbol, q); };
</script>

<Grid {rows} {columns} getRowId={(r) => r.symbol} onReady={(a) => (api = a)} />
```

`patchRows` writes into the rows and repaints only the **rendered** cells whose
field changed — a tick that moves the match price and volume repaints those two
cells, not the row. Anything that may read *other* fields of the row repaints
whenever the row changes: renderers (`render`, `component`, the `cell` snippet),
computed columns, `sub` fields, and any `format` / `cellClass` / `tooltip`
function that **declares the row parameter** — write `(value, row) => …` only
when you read the row, and `(value) => …` otherwise, so a formatter skips ticks
that don't concern it. Off-screen rows pay nothing reactive and read current
values when they scroll in. Footer totals, group subtotals and
selection aggregates stay live.

**A busy feed: read it in a worker.** Every socket message is a task on the
thread that receives it. Past ~10,000 messages a second, receiving them on the
main thread costs real time: in headless Chrome, 14–25% of the main thread at
30,000 a second and 40–70% at 100,000, under a third of it parsing and the rest
the dispatch of each message. Read the socket in a worker instead, and the main
thread takes one batch a frame: 3–6% at any of those rates, with the same
latency (`pnpm bench:feed`; see BENCHMARKS.md).

```ts
// feed.worker.ts
import { serveFeed } from 'bo-grid/realtime';
const feed = serveFeed<string, Partial<Quote>>(); // coalesces per key, like createTickStream
const socket = new WebSocket(FEED_URL);
socket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  feed.push(m.symbol, { last: m.p, volume: m.v });
};
```

```ts
// the page
import { connectFeed } from 'bo-grid/realtime';
const worker = new Worker(new URL('./feed.worker.ts', import.meta.url), { type: 'module' });
const feed = connectFeed<string, Partial<Quote>>(worker, { apply: (batch) => api.patchRows(batch) });
feed.start(); // one batch a frame (at most `cap`, 400); feed.pending, feed.applied, feed.stop(), feed.close()
```

- The two ends talk over a `MessagePort` of their own, so the worker can carry
  other messages too. The page offers its port until `serveFeed` takes it, so
  the worker may set up its feed after an `await`. A dedicated `Worker` only
  (not a `SharedWorker`); name each feed (`name`) when one worker serves
  several.
- Patches cross by structured clone: keep them plain data. One that cannot be
  cloned is dropped and reported (`onError` on both ends), and the rest still
  arrive.
- `onError` also hears when no `serveFeed` answers within 5 s, and when a
  connected worker leaves a request unanswered for 1 s (`feed.stalled`); the
  page then asks again.
- `stop()` keeps what waits in the worker; a batch already on its way is
  still applied.

At a few thousand messages a second, `createTickStream` on the main thread is
just as good.

`component` cells and the `cell` snippet update **in place**. On each patch
they receive a fresh view of the row: same fields, new identity. Their markup
and `$derived` values re-run; the component is not rebuilt, so its DOM, focus
and local state survive. Read `row` reactively, not once at mount. On the
Price board, one component column measured ~22% less main-thread work per
frame at 30,000 events/s than rebuilding it on every patch, and dropped frames
fell from ~20 to ~7.

Values that change in place do not re-sort or re-filter the view on every
tick. For a board whose order must follow the feed (a "top movers" board, a
watchlist sorted by change), set **`liveSort`**:

```svelte
<Grid {rows} {columns} sort={[{ key: 'chg', dir: 'desc' }]} liveSort={500} onReady={(a) => (api = a)} />
```

When a patch changes a field the grid sorts or filters by, the rows it changed
are merged back into place at most every `liveSort` ms (`true`: 500). Only
those rows are sorted, and merged into the rest: on 100,000 rows with 500
changed that takes ~5 ms, against ~21 ms for a full re-sort (`pnpm bench`). A
row that changes only other fields queues nothing. Rows that stop matching a
filter leave, rows that start matching join, and a row whose group field
changed moves to its new group. The focused cell stays on its row as the row
moves, and nothing moves while a cell is being edited or while the pointer
is over the rows (`pauseOnHover`, on by default; mouse and pen only; the
window losing focus or the tab hiding ends the pause), so a row never jumps
just as it is clicked. `liveSort` follows `patchRows`: values
written into rows any other way still need `api.refresh()`.

Two more settings for live screens:

- **`staleAfter`** (ms) dims a row when nothing new has come for it for that
  long: a quote whose feed went quiet. The row comes back the moment it ticks.
  News is a `patchRows` that changed the row, or a new object for it in
  `rows` (it arrived, or an immutable update copied it); a patch that re-sends
  the same values is not news. Style it with `--bo-stale-opacity`
  (default 0.5).
- **`flashNewRows`** flashes a row once when it arrives in `rows`, a new order
  or a new fill (`true`: 600 ms, or a number of ms). A row arrives when its id
  is new: a copy of a row already there does not flash, nor do the rows an
  empty grid gets (a load or a reload), nor a wholesale replacement.

```svelte
<Grid {rows} {columns} liveSort staleAfter={5000} flashNewRows onReady={(a) => (api = a)} />
```

Without `liveSort`, rows hold their place until **`api.refresh()`**, which
re-filters and re-sorts the whole view against the current values. A row that
keeps its position keeps its rendered cells; rows that moved repaint.

On a wall-sized board the per-frame cost grows with the rows on screen
(roughly linearly — 80 rows cost ~2.5× what 30 do). Keep frames inside budget
with the stream's `cap` (rows applied per frame): ticks beyond it wait for the
next frame instead of stretching this one.

On the **Price board** demo (production build, 1,000 symbols, 24 columns, every
changed cell flashing, ~30 rows on screen) a frame of a 30,000 events/s feed
costs ~4.5 ms with `patchRows` against ~5.3 ms through `$state` rows — the
writes themselves are ~2.7× cheaper (0.6 vs 1.6 ms), and the gap grows with the
number of symbols and fields per tick. Numbers and method are in
[BENCHMARKS.md](https://github.com/bonguynvan/bo-grid/blob/main/BENCHMARKS.md#browser-a-busy-price-board); the demo's
**Benchmark** button measures your machine. Set `flashColor: false` on columns
that colour their own text (price-limit tones) so a flash lights only the
background.

On a busy board, set **`flashMotion="hold"`**. By default a flash fades out,
and a CSS fade is restyled and repainted on every frame it runs. With a busy
feed most visible cells are always mid-fade, and that becomes most of the
frame. A held flash is a static tint for the flash window: repainted when it
starts and when the grid's clock drops it, and a repeat tick during the hold
changes nothing. On the Price board with motion allowed, it cuts the main
thread's work per frame from ~30 to ~9 ms at 10,000 events/s and from ~40 to
~12 ms at 30,000, with no dropped frames. That is within ~1 ms of no flash at
all.

```svelte
<Grid {rows} {columns} flashMotion="hold" onReady={(a) => (api = a)} />
```

If the same grid is sometimes quiet and sometimes busy, **`flashMotion="auto"`**
decides per flash as it starts: it fades while few cells flash at once and
holds once more than ~120 overlap. A taller board reaches that sooner, which is
the point: the cost grows with the fading cells on screen. A flash that lights
whole rows (`flashNewRows`, `api.flashCells`) counts each cell it lights, so a
burst of new orders on a blotter holds too.

`showChange: true` shows how far a value moved, not just which way: `▲0.15`
beside the price in the up colour (`▼` down), held, then faded over a second.
The delta is written in the column's own format; `{ format, ms }` customises
the text (`format(delta, row)` gets the signed change) and the duration. In a
narrow column the delta gives way first, so the value is never cut for it. It
fades by animating text colour, not opacity, so it adds no compositor layers.
Use it on the one or two columns that matter (the match price): on the Price
board, one such column measured the same as none, while turning it on for all
13 flashing columns at 30,000 events/s more than doubled the main thread's
work per frame.

**`updateMs`** on a column repaints it at most that often under
`api.patchRows`. Every tick is still written into the row at once, so sort,
filters, totals and the other columns see it; the cell shows the latest value
on its next beat. Use it for values that change on every trade and are read at
a glance (total volume, foreign buy and sell), so they stop repainting every
frame while the prices stay instant:

```ts
{ type: 'number', key: 'tv', header: 'Total vol', updateMs: 250 }
```

The first change after a quiet spell shows at once, and a flash plays on the
repaint, against the value shown before. On the Price board, three such
columns at 250 ms took 4–6% off the frame at 10,000 and 30,000 events/s.

## Live example

<Example id="priceboard" />
