---
title: Cell flashing
description: Flash a cell green or red when its value moves, show how far it moved, flash cells on demand, and keep a busy board's flashes cheap.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A tick flash tells the eye which values just moved. Set `flash: 'auto'` on a column and the grid does the rest: it remembers each cell's last value and flashes green on a rise, red on a fall. There is nothing to keep in app code; write the new value and the cell flashes.

Bid and ask below flash on their own, often in opposite directions in the same row. Status flashes amber whenever it changes. The buttons flash cells whose values did not change, and Motion switches between a fading and a held flash.

<Example name="flashing" title="Flashing cells" />

## Flash modes

```ts
const columns: ColumnDef[] = [
  { type: 'price', key: 'bid', header: 'Bid', flash: 'auto' },
  { type: 'text', key: 'status', header: 'Status', flash: 'change', flashMs: 900 },
];
row.bid = next; // the bid cell flashes, in the direction it moved
```

| `flash` | What flashes |
| --- | --- |
| `'auto'` (alias `'up-down'`) | Each cell on its own: green when the number rose, red when it fell. For prices and other numbers. |
| `'change'` | Each cell on its own, in a neutral amber, on any change: status, quantity, text. |
| `true` | Legacy row-driven mode: every `flash: true` column in the row flashes together, following the row's own `flashSeq` and `flashDir`, which you bump yourself. |

The derived modes are per cell: bid can flash green while ask flashes red in the same row on the same frame. Flash state is keyed on the row id and the column, so a cell stays quiet on first paint and when it scrolls back into view; only a real change flashes.

`flashMs` sets the duration (300 ms by default). Raise it for a slow feed, lower it for a fast one so flashes don't smear together. A column that colours its own text (price-limit tones, for example) should set `flashColor: false`, so the flash lights only the background.

Under `prefers-reduced-motion: reduce` the grid plays no flash at all.

## Showing the change

`showChange: true` shows how far a value moved, not only which way: `▲0.15` beside the price in the up colour (`▼` down), held, then faded over a second.

```ts
{ type: 'price', key: 'last', header: 'Last', flash: 'auto', showChange: true }
{ type: 'price', key: 'last', header: 'Last', showChange: { format: (d) => (d > 0 ? '+' : '') + d.toFixed(2), ms: 1500 } }
```

- The delta is written in the column's own format; `format(delta, row)` receives the signed change, and `ms` sets how long it shows (1,000 by default).
- In a narrow column the delta gives way first, so the value is never cut for it.
- It fades by animating the text colour, so it adds no compositor layers.

Use it on the one or two columns that matter, such as the match price. Each change runs a short animation, so a busy board with it on every column pays real frame time.

## Flash on demand

Some events don't change a value on screen: a block trade, your order filling, an alert level crossed. `api.flashCells` plays the tick flash on the cells you name, changed or not:

```ts
api.flashCells({ rows: [fill.symbol] });                       // the whole row, amber
api.flashCells({ rows: ids, columns: ['symbol'], ms: 1200 }); // just the symbol, longer
api.flashCells({ rows: [id], columns: ['last'], dir: 'up' });  // tinted like a rise
```

- `rows` are row ids (every rendered row when omitted), and `columns` are column keys (every column when omitted).
- `dir: 'up' | 'down'` tints like a rise or a fall; `ms` overrides each column's `flashMs`.
- Only rows on screen flash, as with a tick. The call returns how many rows it flashed.
- Value cells flash (numbers and text). Cells that draw their own content (badges, sparklines, components) don't.
- A tick that lands during the flash takes over with its own direction, and a repeat call replays it.

## Busy boards

By default a flash fades out. A CSS fade is restyled and repainted on every frame it runs, and on a busy board most visible cells are always mid-fade, which becomes most of the frame. `flashMotion="hold"` shows a static tint for the flash window instead: repainted when it starts and when the grid's clock drops it, while a repeat tick during the hold changes nothing.

```svelte
<Grid {rows} {columns} flashMotion="hold" onReady={(a) => (api = a)} height={480} />
```

Measured on the Price board with motion allowed, held flashes cut the main thread's work per frame from about 30 to about 9.4 ms at 10,000 events/s, and from about 40 to about 12.3 ms at 30,000, with no dropped frames. That is within about 1 ms of no flash at all ([BENCHMARKS.md](https://github.com/bonguynvan/bo-grid/blob/main/BENCHMARKS.md#live-frames-where-the-time-goes)).

For a grid that is sometimes quiet and sometimes busy, `flashMotion="auto"` decides per flash as it starts. It fades while few cells flash at once and holds once more than about 120 overlap. A taller board reaches that sooner, which is the point: the cost grows with the fading cells on screen. A flash that lights whole rows (`flashNewRows`, `api.flashCells`) counts every cell it lights, so a burst of new orders on a blotter holds too.

The trading desk board below flashes prices, changes and volume across 1,000 rows, with sparklines and heat cells:

<Example id="trading" />

## Reference

<Props of="column" names={['flash', 'flashMs', 'flashColor', 'showChange']} />

<Props names={['flashMotion', 'flashNewRows']} />

<Props of="api" names={['flashCells']} />
