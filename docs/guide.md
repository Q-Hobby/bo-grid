# bo-grid guide

Everything bo-grid does, section by section. New here? The
[README](../README.md) has the short tour; the
[API reference](https://bonguynvan.github.io/bo-grid/api.html) lists every prop
and export, and the [live demo](https://bonguynvan.github.io/bo-grid/) runs 21
of these grids on one page.

## Contents

- [Using bo-grid with an AI coding assistant](#using-bo-grid-with-an-ai-coding-assistant)
- [Install](#install)
- [Usage](#usage)
  - [Realtime updates](#realtime-updates)
  - [React, Vue, Angular & vanilla](#react-vue-angular--vanilla)
- [Column types](#column-types)
  - [Custom cells](#custom-cells)
  - [Registered cell types](#registered-cell-types)
  - [Tooltips & truncation](#tooltips--truncation)
- [Conditional formatting](#conditional-formatting)
- [Computed columns](#computed-columns)
- [Row height](#row-height)
  - [Sizing the grid](#sizing-the-grid)
- [Pagination](#pagination)
- [Sort & filter](#sort--filter)
  - [Custom filter types](#custom-filter-types)
- [Selection & aggregation](#selection--aggregation)
- [Find in grid](#find-in-grid)
- [Row selection](#row-selection)
- [Row numbers](#row-numbers)
- [Grouping](#grouping)
  - [Server-side grouping](#server-side-grouping)
- [Localization](#localization)
- [Theming](#theming)
- [Server-side / large datasets](#server-side--large-datasets)
  - [Wide grids (column virtualization)](#wide-grids-column-virtualization)
- [Column reorder](#column-reorder)
- [Column resize](#column-resize)
- [Column visibility](#column-visibility)
- [Header groups](#header-groups)
- [Tree data](#tree-data)
  - [Lazy (server-backed) trees](#lazy-server-backed-trees)
- [Master-detail](#master-detail)
- [Per-row styling](#per-row-styling)
- [Inline editing](#inline-editing)
  - [Custom editors, parsing and shared defaults](#custom-editors-parsing-and-shared-defaults)
- [Pinned columns](#pinned-columns)
- [Merged cells](#merged-cells)
- [The grid handle](#the-grid-handle)
- [Export & import](#export--import)
- [Also exported](#also-exported)
- [Pivot tables](#pivot-tables)
- [Accessibility](#accessibility)

## Using bo-grid with an AI coding assistant

Real props, real subpath boundaries, nothing invented:

- **[llms.txt](https://bonguynvan.github.io/bo-grid/llms.txt)** /
  **[llms-full.txt](https://bonguynvan.github.io/bo-grid/llms-full.txt)** —
  machine-readable references. Paste `llms-full.txt` into a chat, or point an
  agent that fetches URLs (Cursor, Windsurf, Claude Code, browsing ChatGPT) at
  it before asking for bo-grid code — it has every `ColumnDef`/`<Grid>` prop,
  every subpath's exports, and a "things an AI commonly gets wrong" list (the
  #1 one: writing `flashSeq++` bookkeeping instead of `flash: 'auto'`).
- **[Cursor/Windsurf rule](./ai/cursor-rules.mdc)** and
  **[CLAUDE.md snippet](./ai/claude-md-snippet.md)** — copy one into your
  own project (`.cursor/rules/bo-grid.mdc` or your `CLAUDE.md`) so every
  session gets it right without you repeating yourself. See
  [docs/ai](./ai) for the full picture.

## Install

```sh
npm i bo-grid
# peer dependency: svelte@^5
```

Works with **SvelteKit / SSR** out of the box — `<Grid>` server-renders to HTML
without touching `window`/`document`/`localStorage` (a CI gate, `pnpm ssr`,
proves it). The package is `sideEffects: false`, so unused exports tree-shake
away. See the **[SvelteKit guide](./sveltekit.md)** for `load`-function data,
server-side / lazy loading, realtime feeds, import helpers, printing, and
layout persistence.

## Usage

```svelte
<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text',      key: 'symbol', sub: 'sector', header: 'Symbol', width: 132 },
    { type: 'price',     key: 'price',  header: 'Price', width: 88, flash: 'auto' },
    { type: 'percent',   key: 'changePct', header: 'Chg %', width: 84 },
    { type: 'heatmap',   key: 'changePct', header: 'Heat', min: -5, max: 5, width: 76 },
    { type: 'volume',    key: 'volume', header: 'Volume', width: 90 },
    { type: 'date',      key: 'listedAt', header: 'Listed', dateStyle: 'short', width: 92 },
    { type: 'sparkline', key: 'candles', sparkKey: 'candles', header: 'Trend', flex: 1 },
  ];

  // Rows must expose `id` plus your data fields.
  // Make the hot fields `$state` so updates flash without re-rendering the table.
  let rows: GridRow[] = $state(/* ... */);
  let filter = $state(''); // bind to your own search input
</script>

<Grid {rows} {columns} {filter} height={640} />
```

### Realtime updates

#### Tick flash

Set `flash: 'auto'` on a column and the grid works the rest out itself — it
remembers each cell's last value and flashes **green on a rise, red on a fall**.
Just write the new value:

```ts
row.price = next; // that's it — the price cell flashes, in the right direction
```

The flash is **per cell**, not per row: bid can flash green while ask flashes red
in the same row on the same frame. Flash state is keyed on (row id, column), so a
cell stays quiet on first paint and when it scrolls back into view — only a real
value change flashes.

| `flash` | Behaviour |
| --- | --- |
| `'auto'` (alias `'up-down'`) | Derived per cell: green up, red down. Numeric columns. |
| `'change'` | Derived per cell: a neutral amber flash on any change (status, qty, text). |
| `true` | Legacy row-driven mode: follows the row's own `flashSeq`/`flashDir`, so every `flash: true` column in the row flashes together and you bump the counter yourself. |

`flashMs` sets the duration (default 300) — raise it for a slow feed, lower it
for a fast one so flashes don't smear together. Reduced-motion is respected.

#### Feeding the grid — `bo-grid/realtime`

A market feed pushes far more messages than a screen can show. Writing each one
straight into reactive state means thousands of updates to paint 60 frames, and
the tab stalls. `bo-grid/realtime` is the pipeline that fixes that — coalesce raw
messages per key (cheap, no reactive writes), then drain a bounded slice once per
animation frame:

```ts
import { createTickStream, createRowIndex, applyPatches } from 'bo-grid/realtime';

const index = createRowIndex(rows, (r) => r.symbol);
const stream = createTickStream<string, Partial<Quote>>({
  apply: (batch) => applyPatches(index, batch), // once per frame, ≤ cap entries
  cap: 400,                                     // max row writes per frame
});
stream.start();

socket.onmessage = (e) => {
  const q = JSON.parse(e.data);
  stream.push(q.symbol, q); // cheap: coalesces, no render
};
```

Per key only the **latest** state is applied — intermediate ticks collapse, which
is what a price board wants (append a trade tape directly instead). `cap` bounds
the work per frame, so a burst can't blow the frame budget: a sustained overload
shows up as a climbing `stream.pending` rather than dropped frames, and
`stream.applied` gives you a throughput counter — it only counts batches that
applied successfully. If `apply` throws, that frame's batch is lost (it's
already off the buffer by the time `apply` runs, so it can't be safely
re-queued) but the frame loop keeps going; pass `onError` to handle it yourself,
otherwise it's re-thrown asynchronously so it doesn't vanish silently.
`applyPatches` skips fields whose value didn't change, so an idle-but-chatty
feed neither re-renders nor flashes.

Row identity for flash comes from the grid's `getRowId` (default `row.id`), not
from the key you index the feed by — keep it stable across updates.

It's a **separate entry** with its own bundle — importing it adds nothing to
the grid core, and it's framework-agnostic (the frame scheduler is injectable,
which is also how it's unit-tested without a browser).

Only on-screen rows render DOM, so off-screen updates cost nothing until they
scroll into view.

#### Busy markets — plain rows + `api.patchRows`

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
[BENCHMARKS.md](../BENCHMARKS.md#browser-a-busy-price-board); the demo's
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

#### Flash on demand — `api.flashCells`

Some events don't change a value you show: a block trade, your order filling,
an alert level crossed. `api.flashCells` plays the tick flash on the cells you
name, changed or not:

```ts
api.flashCells({ rows: [fill.symbol] });                        // the whole row, amber
api.flashCells({ rows: ids, columns: ['symbol'], ms: 1200 });  // just the symbol, longer
api.flashCells({ rows: [id], columns: ['last'], dir: 'up' });   // tinted like a rise
```

`rows` are row ids (every rendered row when omitted), `columns` are column keys
(every column when omitted), `dir: 'up' | 'down'` tints like a rise or fall,
and `ms` overrides each column's `flashMs`. Only rows on screen flash — like a
tick, a flash off screen is never seen — and the call returns how many rows it
flashed. Value cells flash (numbers and text); cells that draw their own
content (badges, sparklines, components) don't. A tick that lands during the
flash takes over with its own direction, and a repeat call replays it.

#### Stream only what's on screen — `onViewportChange`

A board of 1,600 symbols shows 30–80 at a time. `onViewportChange` reports the
data rows on screen (plus the small buffer rendered around them) whenever that
set changes — scroll, sort, filter, new data — and never for a value-only tick.
`createViewportSubscriptions` turns it into subscribe / unsubscribe calls: the
first view subscribes at once, later changes settle for `delay` ms (default
150, so a fast scroll is one change) and then subscribe what came into view and
unsubscribe what left:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createViewportSubscriptions } from 'bo-grid/realtime';

  const subs = createViewportSubscriptions({
    key: (row) => row.symbol,
    subscribe: (syms) => socket.send(JSON.stringify({ op: 'sub', syms })),
    unsubscribe: (syms) => socket.send(JSON.stringify({ op: 'unsub', syms })),
  });
  onDestroy(subs.clear);
</script>

<Grid {rows} {columns} onViewportChange={subs.update} />
```

While a scroll is in progress the previous symbols stay subscribed; `flush()`
applies a pending change at once. Each update costs about a microsecond.

#### Market conventions — `bo-grid/trading`

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

#### Price ladder & time & sales

Two more pieces of `bo-grid/realtime` for the surfaces every trading desk
needs, both pure — no ladder/tape component of their own, just the data
structure or math that makes building one straightforward:

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

### React, Vue, Angular & vanilla

bo-grid also ships a framework-agnostic **custom element**, fully typed. Import it
and drive the whole API through a `config` property:

```ts
import { createBoGrid } from 'bo-grid/element'; // registers <bo-grid>, injects styles
import type { BoGridConfig } from 'bo-grid/element';

const config: BoGridConfig = { columns, rows, theme: 'dark', height: 520 };
document.body.append(createBoGrid(config)); // or set `el.config` on an existing element
```

`bo-grid/element` exports `BoGridConfig` (every `<Grid>` prop), a typed
`BoGridElement`, and the `createBoGrid` helper. `config` is safe to set **after**
the element attaches (the React `ref` + `useEffect` pattern won't crash). It works
in React, Vue, Angular and plain HTML — see
**[docs/frameworks.md](./frameworks.md)** for per-framework recipes and
**[examples/](../examples/)** for runnable, build-free starters. (Svelte `cell`/
`detail` snippets are Svelte-only; from other frameworks use a column's
`render(ctx)` hook, built-in types, or `format`. Native Svelte users should import
`Grid` directly — smaller, and snippets work.)

## Column types

**Data:** `text` · `price` · `percent` · `volume` · `number` · `date` · `currency` ·
`relative` · `heatmap` · `sparkline`
**Rich:** `progress` · `rating` · `tags` · `badge` · `boolean` · `avatar` · `link`
**Escape hatch:** `custom`

Rich types render value as a widget — handy well beyond fintech (CRM, projects,
admin, content). All are themed from the design tokens:

```ts
const columns: ColumnDef[] = [
  { type: 'avatar',  key: 'name',   header: 'Member', sub: 'role' },
  { type: 'badge',   key: 'status', header: 'Status',
    tones: { Active: 'up', Away: 'amber', Offline: 'neutral' } },
  { type: 'progress', key: 'done',  header: 'Progress', min: 0, max: 100 },
  { type: 'rating',  key: 'score',  header: 'Rating', max: 5 },
  { type: 'tags',    key: 'skills', header: 'Skills' },        // value: string[]
  { type: 'boolean', key: 'remote', header: 'Remote', trueLabel: 'Remote', falseLabel: 'Office' },
  { type: 'link',     key: 'email',  header: 'Email', href: (r) => `mailto:${r.email}` },
  { type: 'relative', key: 'seen',   header: 'Last seen' },     // value: epoch ms → "3h ago"
  { type: 'currency', key: 'rate',   header: 'Rate', currency: 'USD' },
];
```

`link` sanitizes its href (`javascript:`/`data:` are blocked); `relative` formats
an epoch-ms value as relative time; `currency` localizes via `Intl.NumberFormat`.

Sizing: `width` (px) or `flex` (grow weight). See `ColumnDef` for per-type options.

By default only `flex` columns take up a change in the grid's width; `width`
columns stay put. So a grid whose only flex column is the first one widens
that column alone when it grows. For every column to scale together, turn on
**`fitColumns`**. Each column then gets a share of the width in proportion to
its `width`, with `minWidth` / `maxWidth` as bounds. Without a `minWidth`,
a column shrinks to 64 px at most (or stays at its own width, if that is
smaller). The grid scrolls sideways only once those floors no longer fit.

```svelte
<Grid {rows} {columns} fitColumns />
```

Values that grow, such as a price gaining a digit or a running volume total,
can outgrow their column and end in "…". Set **`autoWidth: true`** on such a
column and it widens to fit the values on screen.
- It is checked at most every 500 ms. The values are measured with a canvas,
  so the check never forces a layout on a live board.
- It only grows, so values flickering wider and narrower don't make it jump.
  `maxWidth` caps it.
- A width the user dragged or autosized takes over.
- On the Price board, the growing "Tổng KL" column uses it, at no measurable
  cost per frame.

```ts
{ type: 'volume', key: 'totalVol', header: 'Total vol', width: 76, autoWidth: true }
```

### Custom cells

Use `type: 'custom'` and pass a `cell` snippet to render anything — badges,
buttons, links. The snippet receives `{ row, column, value }`:

```svelte
{#snippet cell({ row })}
  <span class:up={row.changePct > 0}>{row.changePct > 0 ? '▲' : '▼'}</span>
{/snippet}

<Grid {rows} {columns} {cell} height={640} />
```

**From plain JS (React/Vue/vanilla, `<bo-grid>`):** snippets are Svelte-only, so
give a column a **`render(ctx)`** function instead. Return an `HTMLElement`/`Node`
(appended as-is — safe) or an HTML **string** (inserted as innerHTML — sanitize
any untrusted data yourself; prefer a Node for that). `ctx` is `{ value, row,
column }`. Display only — sort, filter, tooltip, copy and export still use the
value / `format`:

```js
{ type: 'custom', key: 'trend', header: 'Trend', render: ({ row }) => {
    const el = document.createElement('span');
    el.textContent = row.changePct > 0 ? '▲' : '▼';
    el.style.color = row.changePct > 0 ? 'var(--bo-grid-up)' : 'var(--bo-grid-down)';
    return el;
  } }
```

**A Svelte component per column:** set `component` on any column. It receives
`{ value, row, column, text }` (`text` is the value as copy/export see it):

```ts
import StatusPill from './StatusPill.svelte';
{ type: 'text', key: 'status', header: 'Status', component: StatusPill }
```

### Registered cell types

When the same kind of column appears across grids — a country, a money amount,
an order status — define it once and name it. `cellTypes` maps a name to column
defaults; a column says `cellType: 'name'` and gets them under its own fields:

```svelte
<script lang="ts">
  import { Grid, type CellTypeDef, type ColumnDef } from 'bo-grid';
  import CountryCell from './CountryCell.svelte';

  const cellTypes: Record<string, CellTypeDef> = {
    country: { extends: 'text', component: CountryCell, filter: 'set', width: 140 },
    money: { extends: 'number', decimals: 0, format: (v) => `$${Number(v).toLocaleString()}` },
  };
  const columns: ColumnDef[] = [
    { cellType: 'country', key: 'country', header: 'Country' },
    { cellType: 'money', key: 'rate', header: 'Rate', width: 96 }, // own fields win
  ];
</script>

<Grid {rows} {columns} {cellTypes} height={560} />
```

- **`extends`** names the built-in type the new one builds on — its formatting,
  sorting, filtering, alignment, aggregation and export. Defaults to `custom`
  when the entry draws itself (`component` or `render`), otherwise `text`.
- An entry can set any column field: `format`, `compare`, `align`, `filter`,
  `width`, `cellClass`, `tooltip`, `editable`, type options like `decimals`…
- An unknown `cellType` renders as plain text rather than failing.
- Outside the grid, `resolveColumns(columns, cellTypes)` gives the same
  resolved columns to `toCSV`, `printTable` or `pivot`.

### Tooltips & truncation

Long cell values truncate with an **ellipsis** by default. Set `tooltip` on a
column to reveal the full text in a **styled floating tooltip** on hover (themed,
instant — not the native `title`). `tooltip: true` shows the formatted value;
pass a function for custom text built from the whole row (works for any type,
including `custom`):

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'note', header: 'Notes', width: 220, tooltip: true },
  { type: 'badge', key: 'status', header: 'Status',
    tooltip: (value, row) => `${value} · ${row.role}` },     // custom text
  { type: 'text', key: 'bio', header: 'Bio', flex: 1, wrap: true }, // wrap, no ellipsis
];
```

Set `wrap: true` to let a column wrap onto multiple lines instead of truncating
(pair with a taller `rowHeight`).

**Header tooltips:** `headerTooltip` shows the same styled bubble on the column
header (describe the metric, units, caveats); add `headerInfo: true` for a small
ⓘ cue:

```ts
{ type: 'progress', key: 'workload', header: 'Workload', min: 0, max: 100,
  headerTooltip: 'Share of capacity allocated this sprint (0–100%).',
  headerInfo: true }
```

## Conditional formatting

Paint analytics cues straight into numeric cells — no custom snippet needed.

**Data bars** (`dataBar`): an in-cell bar behind the value, scaled across the
column's range. The range auto-computes over the current view, or set `min`/`max`
(`min: 0` gives absolute proportional bars). When the range spans negatives, bars
diverge left/right around a zero baseline. `color`/`negative` override the default
up/down theme colours.

**Icon sets** (`icons`): an icon beside the value, chosen by the highest threshold
`at` that is ≤ the value. Each rule carries a semantic `tone` (`up` · `down` ·
`amber` · `info` · `neutral`) for its colour.

**Colour scales** (`colorScale`): tint the cell background across the value range —
a soft, themed heat ramp. Auto-ranges over the view (or set `min`/`max`); pass
`mid` for a 3-stop diverging scale; `colors` overrides the stops. Works on any
numeric column (the fixed `heatmap` type still exists for an absolute ramp).

```ts
const columns: ColumnDef[] = [
  // Proportional bar from zero:
  { type: 'volume', key: 'marketValue', header: 'Mkt Value', dataBar: { min: 0 } },
  // Diverging bar (auto-ranged) + an icon keyed by sign:
  { type: 'number', key: 'pnl', header: 'P&L', decimals: 0,
    dataBar: {},
    icons: [
      { at: -Infinity, icon: '▼', tone: 'down' },
      { at: 0,         icon: '▲', tone: 'up' },
    ] },
  // Diverging colour scale around zero (auto-ranged):
  { type: 'number', key: 'pnlPct', header: 'P&L %', decimals: 1, colorScale: { mid: 0 } },
];
```

All three compose with flashing/live cells and add nothing to the core for grids
that don't use them. (In-memory auto-ranging; pass explicit `min`/`max` in source
mode.)

## Computed columns

Derive a column's value from the whole row with `value: (row) => …` — KPIs,
ratios, deltas. The derived value flows through display, sort, filter, group/footer
aggregation, conditional formatting, export and copy, just like a real column.
`key` still names the column (and is the sort/filter key) but need not be a real
field. Computed columns aren't editable (there's no field to write back).

```ts
const columns: ColumnDef[] = [
  { type: 'number', key: 'qty',   header: 'Qty' },
  { type: 'price',  key: 'price', header: 'Price' },
  // No `total` field on the row — derived, and still sortable/filterable/exportable:
  { type: 'price',  key: 'total', header: 'Total', value: (row) => row.qty * row.price,
    groupAgg: 'sum' },
];
```

In-memory mode (a server `source` owns its own derivations). Keep `value()` cheap
and pure — it's called during sort and filter.

## Row height

Uniform 36px by default. Pass `rowHeight` as a number for a different density, or
a function for variable per-row heights (in-memory mode):

```svelte
<Grid {rows} {columns} rowHeight={48} height={640} />
<Grid {rows} {columns} rowHeight={(row, i) => (row.expanded ? 96 : 36)} height={640} />
```

Variable heights use a prefix-sum + binary-search virtualizer, so scrolling stays
O(log n). Source mode is uniform-only (unloaded row heights aren't known).

### Sizing the grid

`height` as a **number** is the scroll viewport's pixel height (the element is
that plus header/pager/footer chrome). Pass a **CSS string** to size the whole
element instead and let the viewport auto-fit the space left over — ideal for
filling a flex/grid cell:

```svelte
<Grid {rows} {columns} height={640} />        <!-- 640px viewport -->
<Grid {rows} {columns} height="100%" />        <!-- fill a sized parent -->
<Grid {rows} {columns} height="80vh" />
```

## Pagination

Prefer pages over one long scroll? Set `pageSize` (> 0) for a paged view with a
first/prev/next/last pager; rows still virtualize within each page. Add
`pageSizeOptions` for a **rows-per-page dropdown** in the pager (observe changes
via `onPageSizeChange`). In-memory mode.

```svelte
<Grid {rows} {columns} height={640} pageSize={25} pageSizeOptions={[25, 50, 100]} />
```

## Sort & filter

Click a column header to sort (asc → desc → off). **Shift-click** additional
headers to sort by multiple columns — each sorted header shows its position in
the order. Sparkline columns aren't sortable; set `sortable: false` on any column
to opt out. Sorting is a snapshot — rows hold position while their values update
in place (trading-grid behaviour), so a realtime feed never reshuffles the view.

Pass a `filter` string to quick-filter rows (matches across column values). Drive
it from your own search input — or set `quickFilter` for a **built-in search box**
above the grid. Set `filterRow` to add a row of **per-column filter inputs** under
the header (rows must match every non-empty column filter; in-memory mode).

For richer filtering, set `filterMenu` to add a **funnel to each column header**.
Clicking it opens a menu whose control matches the column type — text
(contains / equals / starts / ends), number (`=, ≠, <, ≤, >, ≥, between`), or date
(before / after / on / between — whole calendar days in the viewer's time zone,
the same day the cell shows). Set `col.filter: 'set'` for a **set filter** — a
searchable checkbox list of the column's distinct values (All / None). The menu
is lazy-loaded on first open, so it costs nothing until used; disable it per
column with `col.filter: false`:

```svelte
<Grid {rows} {columns} height={640} filterMenu />
```

Filtering is uncontrolled by default. To **own the filter state** (persist it, set
initial filters, sync to the URL), pass a controlled `columnFilters` map and
handle `onFilterChange` — mirrors controlled `sort`. In **server (`source`) mode**
the filter menu still works: text/number/date filters are delegated to your
`RowSource` via `params.columnFilters` (set filters need in-memory data).

### Custom filter types

When the built-in controls don't fit — a capacity band, a lot-size rule, a
"within N km" check — register your own kind with `filterTypes`, and point a
column at it with `filter: 'name'`. The menu keeps its frame (title, **Clear** /
**Apply**, Enter to apply); your editor draws the middle and edits a draft:

```ts
import type { CustomFilter, FilterTypeDef } from 'bo-grid';
import BandEditor from './BandEditor.svelte';

interface BandFilter extends CustomFilter { kind: 'band'; bands: string[] }
const band: FilterTypeDef<BandFilter> = {
  component: BandEditor,                       // receives { filter, onChange, column, values, labels }
  isActive: (f) => f.bands.length > 0,         // optional; default: always active
  test: (value, f) => f.bands.includes(bandOf(Number(value))),
};
```

```svelte
<Grid {rows} {columns} filterMenu filterTypes={{ band }} />
<!-- column: { type: 'progress', key: 'workload', header: 'Workload', filter: 'band' } -->
```

The editor gets the draft as `filter` (the active filter when the menu opened,
or `null`) and calls `onChange(next)` as the user edits; **Apply** commits the
draft when it is active, **Clear** removes it. Set `needsValues: true` to receive
the column's distinct values as `values`, as the set filter does. A custom filter
is a plain object with a `kind`, so it round-trips through `columnFilters`,
`onFilterChange`, `getState()` and a `RowSource` unchanged — pass the same
`filterTypes` to `createArraySource` to apply it there. A filter whose kind is
not registered filters nothing, rather than silently emptying the grid.

Sorting is uncontrolled by default. To own it (persist it, set an initial sort,
or sync to the URL), pass a controlled `sort` array and handle `onSortChange`:

```svelte
<Grid {rows} {columns} height={640} {sort} onSortChange={(s) => (sort = s)} />
```

## Selection & aggregation

Click a cell, then drag or **Shift-click** to extend a rectangular selection.
Keyboard: **arrows** move, **Shift+arrows** extend, **Home/End** jump to the
first/last column (**+Ctrl/⌘** for the first/last cell), **PageUp/PageDown** move
by a page, **Ctrl/⌘+A** select all, **Ctrl/⌘+C** copy the selection as TSV
(Excel-pasteable), **Ctrl/⌘+V** paste, **Esc** clear.

Paste writes a TSV block (from a spreadsheet or the grid's own copy) into
editable cells starting at the selection's top-left. A single copied value fills
the whole selection (Excel behaviour); a block clamps to the grid edges. Pasted
values flow through the same validation as inline editing — non-editable columns
and invalid numbers are skipped — and each accepted cell emits `onCellEdit`, so
paste only does anything when you've wired that callback.

Set `fillHandle` for an **Excel-style fill handle**: the selection grows a small
square at its bottom-right corner; drag it down or right to copy the selected
value(s) across the extended range (editable columns; multi-cell selections tile).

Edits, paste and fill are **undoable** with <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> (redo
with <kbd>Ctrl/⌘</kbd>+<kbd>Y</kbd>). A paste or fill undoes as a single step.

For a read-only / display grid, set `cellSelection={false}` to drop the blue
range-selection highlight (and fill handle) entirely — clicks pass straight
through to `onRowClick` / `onCellClick`:

```svelte
<Grid {rows} {columns} height={640} cellSelection={false} onRowClick={open} />
```

For a **list-detail / master-detail** layout, drive `selectedRowId` (keyed by
`getRowId`) to highlight the active row — independent of the checkbox selection:

```svelte
<Grid {rows} {columns} height={640}
  selectedRowId={active?.id} onRowClick={(r) => (active = r)} />
```

When more than one cell is selected, a footer bar shows live **Sum / Avg / Count /
Min / Max** over the numeric cells in the range — and it keeps updating as a
realtime feed ticks. Choose which stats to show:

```svelte
<Grid {rows} {columns} aggregations={['sum', 'avg', 'count']} height={640} />
```

Set `footer` for a **pinned totals row**: every column with a `groupAgg` shows
that aggregate over all (filtered) rows, sticky to the bottom as you scroll
(in-memory mode).

```svelte
<Grid {rows} {columns} height={640} footer />
```

The totals follow a live feed without rescanning every row: `api.patchRows`
moves them by the rows it changed, and rows edited any other way (`$state`
rows, an `onCellEdit` handler) update them as well. A computed column (`value`)
must depend only on its own row for this; one that reads other rows or the
clock gets a fresh total on the next new view or `api.refresh()`.

Pass `pinnedRows` to keep rows stuck to the **top**, always visible above the
scroll — a benchmark, a summary, or "your position". They render with the normal
columns (and `rowClass`) but are display-only:

```svelte
<Grid {rows} {columns} height={640} pinnedRows={[benchmark]} />
```

To let users pin rows themselves, such as the symbols they watch on a long
board, add **`rowPinning`**. Right-clicking a row then offers "Pin to top", and
on a pinned row "Unpin", ahead of any `rowMenu` items.
- A pinned row shows above the scroll and also stays in its place in the body.
  It keeps updating, `api.patchRows` included.
- Pins are remembered with `persistKey` and carried by `getState()` /
  `applyState()`.
- `onRowPinChange(ids)` reports changes. `api.pinRow(id, pinned?)` and
  `api.getPinnedRowIds()` do the same from code.

```svelte
<Grid {rows} {columns} rowPinning persistKey="watchlist" onRowPinChange={(ids) => save(ids)} />
```

## Find in grid

`findBar` turns on Ctrl/⌘+F inside the grid. A small find bar opens over the
top-right corner; it is off by default, since it takes Ctrl+F from the browser
while the grid has focus.
- It matches what the cells display (their formatted text), ignoring case,
  and shows "3 of 12".
- Enter and Shift+Enter step through the matches, and each match is focused
  and scrolled into view. Escape closes the bar and returns focus to the grid.
- `api.openFind(query?)` opens it from your own search button.

```svelte
<Grid {rows} {columns} findBar />
```

Matches are found once per query and view, not on every tick, so on a live
board the values can move after the bar has found them. It searches
in-memory rows (not a `source`), up to 10,000 matches.

## Row selection

Set `rowSelection` for a leading checkbox column — whole-row selection keyed by
`row.id`, so it survives sorting and filtering (unlike the positional cell
selection above). The header checkbox selects/clears all matching rows, and
<kbd>Space</kbd> toggles the focused row from the keyboard.
`onRowSelectionChange` reports the selected ids:

```svelte
<Grid
  {rows}
  {columns}
  height={640}
  rowSelection
  onRowSelectionChange={(ids) => (selected = ids)}
/>
```

In server (`source`) mode the per-row checkboxes work on loaded rows; the
select-all header checkbox is disabled (unloaded ids can't be enumerated).

Selection keys off `row.id` by default; pass `getRowId` for string/UUID/composite
keys (`getRowId={(r) => r.uuid}`).

## Row numbers

`rowNumbers` adds a leading row-number column, as in a spreadsheet. Data rows
are numbered 1, 2, 3… in view order, so the numbers follow sorting and
filtering. Group headers get no number. The column is sticky when the grid
scrolls sideways, and sized to the widest number. Its cells are row headers,
so a screen reader announces the row's number with each cell. The header
reads "Row" (the `rowNumber` label).

```svelte
<Grid {rows} {columns} rowNumbers height={640} />
```

## Grouping

Pass `groupBy` (column keys) to group rows — single or nested. Groups are
collapsible (click the header) and show **live subtotals** under any column with
a `groupAgg` set:

```svelte
<script>
  const columns = [
    { type: 'price',  key: 'price',  header: 'Price',  groupAgg: 'avg' },
    { type: 'volume', key: 'volume', header: 'Volume', groupAgg: 'sum' },
    // …
  ];
</script>

<Grid {rows} {columns} groupBy={['sector', 'exchange']} height={640} />
```

Group headers are the same height as data rows, so virtual scrolling stays smooth
over very large grouped sets. Subtotals recompute live as the feed ticks, and the
current group's header stays pinned to the top as you scroll within it.

### Server-side grouping

When the data is grouped on the server (or too large to fetch upfront), pass
**`lazyGroups`** (the group summaries) and **`loadGroup`** (load a group's rows on
expand). Headers show the server-provided count and preformatted aggregates; rows
load lazily with a loading row, then cache. See the **Server groups** example.

```svelte
<Grid
  rows={[]}
  {columns}
  lazyGroups={[
    { key: 'North America', count: 142, agg: { amount: '$2.4M' } },
    { key: 'Europe', count: 98, agg: { amount: '$1.8M' } },
  ]}
  loadGroup={(key) => fetch(`/api/orders?group=${key}`).then((r) => r.json())}
  height={520}
/>
```

## Localization

`labels` overrides any string the grid renders itself (menus, filter editor,
pager, aria labels); `locale` sets the default locale for the built-in `price`,
`date`, `currency` and `relative` formatting, the aggregation bar and the pager
row count. A column's own `locale` wins over the grid's.

```svelte
<Grid
  {rows}
  {columns}
  locale="vi-VN"
  labels={{
    autosize: 'Vừa nội dung',
    noRows: 'Không có dòng nào khớp',
    filterFor: (h) => `Lọc cột ${h}`,
    pageOf: (p, n, total) => `Trang ${p} / ${n} · ${total} dòng`,
  }}
/>
```

Pass only what you are changing — it is merged over the English defaults.
Interpolated entries are **functions**, not `{0}` placeholders, so a translation
can reorder the parts. Resolved per grid, so two grids on a page can use two
languages. `DEFAULT_LABELS` lists every key.

## Theming

Dark-first and self-contained — no CSS import required. Use the `theme` prop with
a built-in preset or a custom token map:

```svelte
<Grid {rows} {columns} theme="light" height={640} />
<Grid {rows} {columns} theme={{ bg: '#0b1020', up: '#22d3ee' }} height={640} />
```

Eight built-in presets are exported (`GridTheme`): `darkTheme`, `lightTheme`,
`highContrastDark`, `highContrastLight`, `midnightTheme`, `terminalTheme`, and
`tradecanvasTheme` / `tradecanvasLightTheme` (the palette TradeCanvas charts and
TradingDek share, so a grid sits flush next to a chart) — plus a
`themePresets` name→preset map (and a `ThemePreset` type) for a theme picker:

```svelte
<script>
  import { Grid, themePresets, type ThemePreset } from 'bo-grid';
  let preset: ThemePreset = 'midnight';
</script>
<Grid {rows} {columns} theme={themePresets[preset]} height={640} />
```

Or set any `--bo-grid-*` custom property on an ancestor — the prop is just a
convenience over these:

```css
.my-app {
  --bo-grid-bg: #fff;
  --bo-grid-text: #1a1a1a;
  --bo-grid-up: #16a34a;
  --bo-grid-down: #dc2626;
}
```

Native form controls (checkboxes, date pickers, number spinners, search inputs,
scrollbars) follow the theme automatically via `color-scheme` + `accent-color`.
A custom theme defaults to dark; set `scheme: 'light'` (or `--bo-grid-scheme:
light`) for a light one.

**Tokens** cover colour, typography (`mono`/`sans`/`fontSize`), shape (`radius`),
and density (`cellPad`, plus the `rowHeight` prop) — so the whole look is yours.
Numeric columns use tabular figures so digits line up. A few looks:

```svelte
<!-- Compact / dense -->
<Grid {rows} {columns} rowHeight={28}
  theme={{ fontSize: '12px', cellPad: '6px' }} height={640} />

<!-- Roomy & rounded -->
<Grid {rows} {columns} rowHeight={44}
  theme={{ radius: '16px', cellPad: '16px', fontSize: '14px' }} height={640} />

<!-- Branded -->
<Grid {rows} {columns}
  theme={{ bg: '#0b1020', headerBg: '#0d1226', up: '#22d3ee', down: '#fb7185',
           selBorder: '#22d3ee', radius: '12px' }} height={640} />
```

## Server-side / large datasets

Instead of an in-memory `rows` array, back the grid with a **`RowSource`** — the
grid requests only the visible window (plus overscan), so the dataset can be far
larger than memory. Sort and filter are delegated to the source; unloaded rows
render as skeletons.

```svelte
<script lang="ts">
  import { Grid, createArraySource, type RowSource } from 'bo-grid';

  // Your own source: fetch a window from the server.
  const source: RowSource = {
    async getRows({ range, sort, filter }) {
      const res = await fetch(`/api/rows?offset=${range.start}&limit=${range.end - range.start}` +
        `&sort=${sort?.key ?? ''}&dir=${sort?.dir ?? ''}&q=${filter}`);
      return res.json(); // { rows, total }
    },
  };
</script>

<Grid {columns} {source} height={640} />
```

`createArraySource(rows, { latency, filterKeys })` adapts an in-memory array to
the same interface (handy for testing the path or client-side data). Grouping is
client-only, so it's not applied in source mode.

### Wide grids (column virtualization)

Rows are virtualized vertically by default. For very wide grids (100+ columns),
add **`virtualizeColumns`** to also virtualize horizontally — only the columns in
the scroll window (+ overscan) render, so a 60-column grid costs about the same as
a handful. It switches the grid to fixed-width horizontal scroll; **pinned columns
always render**. See the **Wide** example.

```svelte
<Grid {rows} {columns} virtualizeColumns height={520} />
```

On a wide board, **`columnHover`** highlights the column under the pointer,
body and header, so a value is easy to follow down its column. It draws one
overlay for the whole column rather than restyling each cell, and pinned columns
are covered too. The colour is the theme token `colHover`.

```svelte
<Grid {rows} {columns} columnHover height={520} />
```

## Column reorder

Pass `onRowReorder(from, to)` to enable **drag-to-reorder rows** via a handle in
the first column — reorder your own `rows` array in the callback (flat, unsorted,
in-memory lists). Drag any column header to reorder columns; pass `persistKey` to
remember the user's order across reloads (saved to `localStorage`):

```svelte
<Grid {rows} {columns} persistKey="watchlist" height={640} />
```

## Column resize

Drag the grip on a header's right edge to resize a column; **double-click** the
grip to reset it to its default width. Resizing a fit-to-width (`flex`) column
pins it to the dragged width and lets its neighbours absorb the difference.
Under `fitColumns` the edge still follows the pointer. The columns before it
keep their widths, and the ones after it share the difference in proportion.
The same `persistKey` remembers widths across reloads.

Bound a column's draggable range with `minWidth` / `maxWidth`. Resizing is on by
default. Turn it off for the whole grid with `resizable={false}`, or per column
with `resizable: false` (handy for a fixed action column):

```svelte
<Grid {rows} {columns} resizable={false} height={640} />
```

## Column visibility

Pass `hiddenColumns` (column keys to hide) — controlled, like `filter`. Build
your own column-picker UI and drive the prop; the grid stays presentation-only:

```svelte
<Grid {rows} {columns} hiddenColumns={['bonus', 'rating']} height={640} />
```

Or set `columnMenu` for a **per-column header menu** (a ⋮ trigger, or
<kbd>Alt</kbd>+<kbd>↓</kbd> on the focused column) with **sort**, **pin**
(left/right/unpin), **Autosize** (fit to content), and **Hide column** actions,
and `columnsPanel` for a **"Columns" button** that opens a checklist to toggle
visibility (and restore hidden columns). Runtime hide/pin compose with
`hiddenColumns` / `col.pinned`, persist via `persistKey`, and hide reports through
`onColumnVisibilityChange`:

```svelte
<Grid {rows} {columns} columnMenu height={640}
  onColumnVisibilityChange={(hidden) => (myHidden = hidden)} />
```

## Header groups

Give columns a `group` label to render a spanning parent header over consecutive
columns that share it (works best with fixed-width columns):

```ts
const columns = [
  { type: 'text',  key: 'symbol', header: 'Symbol', width: 120, group: 'Holding' },
  { type: 'number', key: 'shares', header: 'Shares', width: 90,  group: 'Holding' },
  { type: 'price', key: 'last',   header: 'Last',   width: 90,  group: 'Pricing' },
];
```

## Tree data

Pass `getChildren` to render hierarchical rows — `rows` become the roots, and each
node gets an indented first column with an expand chevron when it has children:

```svelte
<Grid {rows} {columns} height={520} getChildren={(r) => r.children} />
```

In tree mode the grid renders the tree directly (filter/sort/group/paginate are
not applied to it). Nodes are keyboard-accessible: **→** expands a collapsed node,
**←** collapses an expanded one, and rows expose `aria-level` / `aria-expanded`.

### Lazy (server-backed) trees

For hierarchies too large to ship upfront, use **`loadChildren`** (async) instead
of `getChildren`. Children load on first expand — the grid shows a loading row,
then caches them. Pair it with **`hasChildren`** (a cheap predicate) so the chevron
shows without loading. See the **Lazy tree** example.

```svelte
<Grid
  {rows}
  {columns}
  height={520}
  hasChildren={(r) => r.kind === 'folder'}
  loadChildren={(r) => fetch(`/api/children/${r.id}`).then((res) => res.json())}
/>
```

## Master-detail

Pass a `detail` snippet to render an expandable panel under each row — the grid
adds a leading expand toggle and virtualizes the expanded heights (`detailHeight`,
default 160). In-memory mode:

```svelte
<Grid {rows} {columns} height={640} detailHeight={120} detail={rowDetail} />

{#snippet rowDetail({ row })}
  <div class="detail">…anything about {row.name}…</div>
{/snippet}
```

## Per-row styling

Return a class from `rowClass` to style rows by their data (e.g. red/green book
levels). Rows live inside the grid, so target the class with `:global(...)`:

```svelte
<Grid {rows} {columns} height={640} rowClass={(r) => (r.up ? 'gain' : 'loss')} />

<style>
  :global(.bo-grid .row.gain) { color: var(--up); }
  :global(.bo-grid .row.loss) { color: var(--down); }
</style>
```

For per-column styling, a column's `cellClass` (static or `(value, row)`
conditional) and `headerClass` add classes to that column's cells/header:

```ts
{ type: 'number', key: 'pnl', header: 'P&L',
  cellClass: (v) => (Number(v) < 0 ? 'loss' : 'gain'), headerClass: 'num-head' }
```

`onRowClick(row, event)` fires when a row is activated by click or <kbd>Enter</kbd>
on the focused cell — wire it to open a detail view or navigate.

Pass `rowMenu(row)` to add a **right-click menu** of row actions; each item runs
its `onSelect` and the menu closes (also on outside-click or <kbd>Esc</kbd>). It
is keyboard-accessible: the <kbd>ContextMenu</kbd> key (or
<kbd>Shift</kbd>+<kbd>F10</kbd>) opens it at the focused cell.

```svelte
<Grid {rows} {columns} height={640}
  rowMenu={(r) => [{ label: 'Delete', onSelect: () => remove(r.id) }]} />
```

## Inline editing

Mark a column `editable: true`. Double-click a cell (or press <kbd>Enter</kbd> on
the focused cell) to edit; <kbd>Enter</kbd>/blur commits, <kbd>Esc</kbd> cancels.
Or just start typing — a printable key on a focused editable cell opens the
editor seeded with that character (Excel-style type-to-edit). The editor matches
the column type: numeric columns get a number input, `date` columns a native date
picker, `options` columns a `<select>`, everything else a text input. The grid is
controlled, so it reports the change via `onCellEdit` — update your own row data
there:

```svelte
<Grid
  {rows}
  {columns}
  height={640}
  onCellEdit={(e) => (e.row[e.column.key] = e.value)}
/>
```

`e.value` is parsed to a number for numeric columns (invalid input is rejected),
otherwise the raw string. Make the edited field `$state` so the cell updates. Add
a column `validate(value, row)` to reject edits that fail your own rule (it
applies to paste too):

```ts
{ type: 'number', key: 'qty', header: 'Qty', editable: true, validate: (v) => v >= 0 }
```

Give an editable column `options` to edit it via a dropdown instead of a text
input (enum/status columns):

```ts
{ type: 'text', key: 'status', header: 'Status', editable: true,
  options: ['New', 'Active', 'Closed'] }
```


### Custom editors, parsing and shared defaults

Give a column an **`editor`** component to replace the built-in input. It
receives `{ value, row, column, seed, commit, cancel }`, calls `commit(value)`
with any value (no parsing) or `cancel()`; Escape cancels and focus leaving the
editor cancels. With an editor, display widgets such as `rating` or `tags`
become editable:

```ts
import RatingEditor from './RatingEditor.svelte';
{ type: 'rating', key: 'rating', header: 'Rating', editable: true, editor: RatingEditor }
```

**`parse(raw, row)`** turns typed or pasted text into the stored value — it runs
for the built-in editor, paste and fill, ahead of the number/date coercion.
Return `undefined` (or `NaN`) to reject the input:

```ts
{ type: 'number', key: 'salary', header: 'Salary', editable: true,
  parse: (raw) => (/\d/.test(raw) ? Number(raw.replace(/[^\d.-]/g, '')) : undefined) }
```

`validate` then sees the parsed (or committed) value. **`defaultColumn`** applies
settings under every column — a column's own fields, and its registered
`cellType`, win:

```svelte
<Grid {rows} {columns} defaultColumn={{ resizable: false, tooltip: true }} />
```

## Pinned columns

Set `pinned: true` (or `'left'`) on a column to keep it visible while the rest
scroll horizontally; `pinned: 'right'` sticks it to the right edge (e.g. an
actions or total column). Opt-in: with no pinned columns the grid stays
fit-to-width (no horizontal scroll).

```ts
const columns = [
  { type: 'text',  key: 'symbol', header: 'Symbol', width: 132, pinned: true },
  { type: 'price', key: 'price',  header: 'Price',  width: 88,  pinned: true },
  // …wider columns scroll under the pinned ones…
  { type: 'number', key: 'pnl',   header: 'P&L',    width: 96,  pinned: 'right' },
];
```

## Merged cells

**Down — `spanRows`.** Merge a column's cell over adjacent rows that hold the
same value — the blotter case, where account, order and symbol repeat down every
fill and the repetition hides the boundaries you are looking for:

```ts
const columns: ColumnDef[] = [
  { type: 'text',  key: 'account', header: 'Account', width: 110, spanRows: true },
  { type: 'text',  key: 'order',   header: 'Order',   width: 104, spanRows: true },
  { type: 'text',  key: 'symbol',  header: 'Symbol',  width: 84,  spanRows: true },
  { type: 'text',  key: 'time',    header: 'Time',    width: 80 },
  { type: 'price', key: 'price',   header: 'Price',   flex: 1 },
];
```

`true` joins rows whose values are equal (blank values never merge). Pass a
comparator to decide per adjacent pair instead — e.g. the same calendar day:

```ts
{ type: 'date', key: 'filledAt', header: 'Day', spanRows: (a, b) => sameDay(a.filledAt, b.filledAt) }
```

- **Hierarchical, in display order.** A run also breaks wherever a spanning
  column to its left breaks, so a symbol never merges across two accounts.
  Reordering columns reorders the hierarchy.
- **Only adjacent rows merge**, so it follows the current sort: sort by the
  merged column for the biggest merges. Group headers, tree placeholders and an
  expanded detail row break every run.
- **A drawing rule, not a data change.** Every row keeps its value: sort,
  filter, copy, CSV/Excel export and `toHTMLTable` see one value per row.
- Merged cells are not editable; selecting any row in a run highlights the cell.
- In-memory mode only (a `source` sees one window at a time). Like sort and
  filter, runs are recomputed when the view changes, not on every realtime tick.

**Across — `colSpan`.** Return how many columns a cell covers for a given row;
the covered columns are not drawn. A note row spanning the fill columns:

```ts
{ type: 'text', key: 'time', header: 'Time', width: 80,
  colSpan: (row) => (row.note ? 3 : 1),
  format: (v, row) => (row?.note ? row.note : String(v)) }
```

The leftmost claim wins; a span is clamped at the last column and at a
pinned/scrolling boundary. A covered cell breaks the `spanRows` run of the
column it covers, but not of a column to its left. Combined on one column, a
run only continues while the rows below span the same width. `colSpan` is
ignored under `virtualizeColumns`. See the **Blotter** example.

The planning is a pure function, `buildMergePlan(...)` / `colSpanRow(...)`,
exported for anything that renders its own view of the same rows.

## The grid handle

`onReady` hands you one object for the things that are *actions* rather than
state — they have no resting value to express them as a prop. It is called once,
when the grid mounts.

```svelte
<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  let api: GridApi | undefined;
</script>

<Grid {rows} {columns} onReady={(a) => (api = a)} />
<button onclick={() => api?.scrollToRow('ORD-1042', 'center')}>Find order</button>
```

| Method | What it does |
| --- | --- |
| `scrollToRow(key, align?)` | Scroll a row (by `getRowId`) into view; `align` is `'nearest'` (default), `'start'`, `'center'` or `'end'`. `false` when the row is not in the current view — filtered out, on another page, or in a `source` grid |
| `focusCell(rowKey, columnKey)` | Focus and select one cell. `false` when the row or column is not visible |
| `getSelectedRows()` | Ticked rows (needs `rowSelection`), in view order |
| `autosizeColumns(keys?)` | Fit columns to their content, as the column menu's **Autosize** does |
| `exportCSV(filename?)` | Download the **current view** (after filter and sort); the writer loads on demand |
| `getState()` · `applyState(s)` | The user's whole layout as one plain object — see below |

**Saving a layout.** `getState()` returns the column order, widths, runtime
hidden columns, pin overrides, sorts and filters. It is JSON-safe, so keep it
wherever you keep user settings. `applyState(saved)` fits it onto the columns as
they are *now*: entries for columns that no longer exist are dropped, a column
that is new lands where it is declared (after the nearest column declared before
it), and malformed fields are ignored rather than thrown on. A state from a
different `version` is refused whole — `applyState` returns `false` — because half
a layout is worse than none. The fitting rules are exported as
`reconcileState(saved, columnKeys)` for a backend that wants to apply them
itself.

`persistKey` still works as before for the browser-local convenience case; the
handle is for layouts you store yourself (per user, per workspace).

## Export & import

CSV export — and import — are dependency-free:

```ts
import { exportCSV, toCSV, parseCSV } from 'bo-grid';

exportCSV('tickers.csv', rows, columns);          // triggers a download
const text = toCSV(rows, columns, { formatted: true }); // or get the string
const rows = parseCSV(text, columns);             // …and back to rows (round-trip)
```

`parseCSV` is RFC4180-aware (quoted fields, embedded commas/quotes/newlines), maps
headers to columns, coerces numeric/`date` columns, and stamps `id` + flash fields
so the result drops straight into `<Grid rows={…}>`. There's also `parseTSV` (tab-
separated — what Ctrl/⌘+C copies), and for JSON/API data, `rowsFromObjects(objects)`
/ `parseJSON(text)`:

```ts
import { rowsFromObjects } from 'bo-grid';
const rows = rowsFromObjects(await (await fetch('/api/rows')).json());
```

Not sure what you'll get? **`parseRows(text, columns?)`** auto-detects JSON / TSV /
CSV — perfect for a paste handler:

```svelte
<div onpaste={(e) => (rows = parseRows(e.clipboardData.getData('text'), columns))}>…</div>
```

See the **CSV import** demo (CSV / TSV / JSON / Auto-detect).

Excel export loads SheetJS via **dynamic import**, so it lands in its own lazy
chunk and never bloats your core bundle. `xlsx` is an **optional peer dependency**
— install it only if you use this:

```ts
import { exportXLSX } from 'bo-grid';
await exportXLSX('tickers.xlsx', rows, columns); // npm i xlsx
```

Sparkline columns are skipped; numeric columns export as raw numbers so
spreadsheets can compute on them (pass `{ formatted: true }` for display strings).
Ctrl/⌘+C still copies the current selection as TSV.

**Printing.** The grid virtualizes, so printing it directly drops off-screen rows.
`printTable(rows, columns, { title })` opens a print window with **all** rows as a
clean table (Save-as-PDF from the dialog); `toHTMLTable(rows, columns)` returns
that table as an HTML string to embed. See the **Print** demo.

```ts
import { printTable } from 'bo-grid';
printTable(rows, columns, { title: 'Sales report' });
```

## Also exported

`Sparkline` component · `drawCandles` / `setupHiDpiCanvas` (draw on your own
canvas) · `fmtPrice` / `fmtPercent` / `fmtVolume` / `fmtDate` · `heatColor` ·
`Selection` · `aggregate` · `toCSV` / `exportCSV` / `exportXLSX` / `rowsToMatrix` ·
`parseCSV` / `parseCSVMatrix` / `parseTSV` / `parseJSON` / `parseRows` /
`rowsFromObjects` · `toHTMLTable` / `printTable`.

## Pivot tables

`pivot()` transforms flat rows into a pivot table (rows + dynamic columns) you
hand straight to `<Grid>` — group by row fields, spread a field's values into
columns, and aggregate a measure into each cell:

```svelte
<script lang="ts">
  import { Grid, pivot } from 'bo-grid';

  const { rows: pivotRows, columns: pivotColumns } = pivot(data, {
    rowFields: ['sector'],     // → leading text columns
    columnField: 'exchange',   // distinct values → columns (+ a Total)
    measure: 'volume',
    agg: 'sum',
  });
</script>

<Grid rows={pivotRows} columns={pivotColumns} height={640} />
```

It's a pure function, so call it as a snapshot or reactively as you prefer.

## Accessibility

The grid follows the ARIA grid pattern. Because rows are virtualized, it exposes
the real dimensions and positions so assistive tech isn't misled:

- `role="grid"` (`treegrid` with tree data) with `aria-rowcount` /
  `aria-colcount` (full size, not the rendered window) and
  `aria-multiselectable`. It holds only rows; the toolbar, pager and menus sit
  beside it.
- `role="row"` + `aria-rowindex` on rows, `role="gridcell"` + `aria-colindex` +
  `aria-selected` on cells, `role="columnheader"` + `aria-sort` on headers.
- `aria-activedescendant` tracks the focused cell for screen readers.
- Sparkline cells carry a text `aria-label`; sticky/skeleton duplicates are
  `aria-hidden`; the aggregation bar is an `aria-live` status region.
- Fully keyboard-operable: one tab stop with arrow-key navigation, APG-pattern
  menus (focus moves in, arrow-navigable, returns focus on close), a keyboard path
  to filtering (column menu → **Filter…**), and visible `:focus-visible` rings on
  every reachable control. Respects `prefers-reduced-motion`.

bo-grid targets **WCAG 2.1 AA**. See **[ACCESSIBILITY.md](../ACCESSIBILITY.md)** for
the full keyboard map, roles, measured contrast ratios, and conformance notes from
the audit.
