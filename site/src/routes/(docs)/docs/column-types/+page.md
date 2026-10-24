---
title: Column types
description: Pick a column type for each column, from prices and percentages to badges, ratings and progress bars, or register your own.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A column's `type` decides how its values look and behave: the number format, the alignment, how it sorts and which filter it offers. Data types format numbers, dates and money. Rich types draw the value as a small widget. When none fits, register a type of your own with `cellTypes`, or draw the cell yourself with [custom cells](../custom-cells/).

Every column below is a built-in type. Sort any of them: each sorts by its plain value, not by the widget.

<Example name="column-types" title="Rich column types" />

## Data types

| Type | Value | Shows |
| --- | --- | --- |
| `text` | string | Text; `sub` names a field shown as a second, dimmer line |
| `price` | number | A price with two decimals, in the column's locale |
| `percent` | number | A signed percentage (`+1.20%`), coloured up or down |
| `volume` | number | A compact count: 1.2K, 3.4M, 1.1B, 2.0T |
| `number` | number | A number with `decimals` places (default 2) |
| `currency` | number | Money in `currency` (default USD), through `Intl.NumberFormat` |
| `date` | epoch ms (or a `Date`) | A date; `dateStyle` is `'short'` or `'medium'` (default) |
| `relative` | epoch ms | A relative time: "3 hours ago" |
| `heatmap` | number | The value on a colour ramp from `min` to `max` |
| `sparkline` | candles | A small chart drawn from the row field named by `sparkKey` |

## Rich types

| Type | Value | Shows |
| --- | --- | --- |
| `avatar` | display name | Initials in a circle, with an optional `sub` line |
| `badge` | string | A pill; `tones` maps values to `up`, `down`, `amber`, `info` or `neutral` |
| `progress` | number | A bar from `min` to `max` |
| `rating` | number | Stars out of `max` |
| `tags` | string array, or a comma-separated string | Chips |
| `boolean` | boolean | `trueLabel` or `falseLabel` |
| `link` | text | A link to `href(row)`; `newTab` opens a new tab |
| `custom` | anything | Whatever the grid's `cell` snippet draws |

```ts
const columns: ColumnDef[] = [
  { type: 'avatar', key: 'name', header: 'Member', sub: 'role' },
  { type: 'badge', key: 'status', header: 'Status', tones: { Active: 'up', Away: 'amber', Offline: 'neutral' } },
  { type: 'progress', key: 'workload', header: 'Workload', min: 0, max: 100 },
  { type: 'rating', key: 'rating', header: 'Rating', max: 5 },
  { type: 'tags', key: 'skills', header: 'Skills' },
  { type: 'boolean', key: 'remote', header: 'Where', trueLabel: 'Remote', falseLabel: 'Office' },
  { type: 'link', key: 'email', header: 'Email', href: (r) => `mailto:${r.email}` },
];
```

- `link` blocks unsafe hrefs (`javascript:` and `data:` URLs).
- Rich types take their colours from the theme, so they follow light and dark themes with no extra code.
- A widget is only how a value is drawn: sorting, filtering, copying and export use the value itself.

## Registered cell types

When the same kind of column appears in several grids, such as a country, a money amount or an order status, define it once and give it a name. `cellTypes` maps a name to column defaults, and a column that says `cellType: 'name'` gets them under its own fields:

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
    { cellType: 'money', key: 'rate', header: 'Rate', width: 96 }, // its own width wins
  ];
</script>

<Grid {rows} {columns} {cellTypes} height={560} />
```

- **`extends`** names the built-in type the new one builds on: its formatting, sorting, filtering, alignment, aggregation and export. It defaults to `custom` when the entry draws the cell itself (`component` or `render`), and to `text` otherwise.
- An entry can set any column field: `format`, `compare`, `align`, `filter`, `width`, `cellClass`, `tooltip`, `editable`, and type options such as `decimals`.
- An unknown `cellType` renders as plain text rather than failing.
- Outside the grid, `resolveColumns(columns, cellTypes)` returns the same resolved columns, for `toCSV`, `printTable` or `pivot`.

The **Team** example registers a `country` type with a flag component: see [Custom cells](../custom-cells/).

## Reference

<Props names={['cellTypes', 'defaultColumn', 'locale']} />

<Props of="column" names={['format', 'component', 'locale']} />

Every type and the options it adds are listed in the [Props reference](../reference/#column-types).
