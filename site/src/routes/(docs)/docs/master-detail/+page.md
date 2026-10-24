---
title: Master-detail
description: Expand a row into a detail panel underneath it, drawn by a snippet with anything inside, including another grid.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Master-detail lets a row expand into a panel underneath it, for information that does not fit in columns: an order's fills, a customer's contacts, a chart. The grid adds a leading expand toggle to each row and draws the panel from a snippet you pass.

Click the toggle at the start of a row to open its panel; open several, then scroll:

<Example name="master-detail" title="Rows that expand into a detail panel" />

## Adding a detail panel

Pass a `detail` snippet, declared inside `<Grid>` so it is typed from the prop. It receives `{ row }`, and its content can be anything, including another `Grid`:

```svelte
<Grid {rows} {columns} detailHeight={120} height={480}>
  {#snippet detail({ row })}
    <div class="detail">
      <strong>{row.name}</strong> · {row.sector}
    </div>
  {/snippet}
</Grid>
```

- `detailHeight` sets the panel's height in pixels (default 160).
- Expanded panels are virtualized with the rows, so many open panels stay cheap to scroll.
- Master-detail needs the rows in memory; it is not available with a server [data source](../server-data/). Rows keep one height, so give `rowHeight` a number rather than a function.
- A detail row breaks [merged-cell](../merged-cells/) runs.

To highlight one "open" row without expanding it, for a list beside a separate detail view, use `selectedRowId` and `onRowClick` instead (see [Row selection](../row-selection/#one-active-row)).

## Outside Svelte

`detail` is a Svelte snippet, so the React and Vue components and the `<bo-grid>` element cannot use it. See [React, Vue & more](../frameworks/#custom-cells-outside-svelte).

## Reference

<Props names={['detail', 'detailHeight']} />
