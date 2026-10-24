---
title: Column types
description: TODO
---

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

## Registered cell types

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
