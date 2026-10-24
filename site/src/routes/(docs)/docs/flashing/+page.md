---
title: Cell flashing
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

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

## Flash on demand

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

## Live example

<Example id="trading" />
