---
title: Custom cells
description: Draw any cell your own way with a Svelte snippet, a component or a plain render function, and add styled tooltips to cells and headers.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

When a built-in [column type](../column-types/) is not enough, draw the cell yourself. There are three ways, and each changes only how the cell looks: sorting, filtering, copying and export still use the cell's value (and `format`, if set).

- A **`cell` snippet** on the grid, for `type: 'custom'` columns, in Svelte.
- A **`component`** on a column: a Svelte component per column, reusable across grids.
- A **`render(ctx)`** function on a column, which returns a DOM node or an HTML string. It works from React, Vue and plain JavaScript as well.

The Move column below is a `cell` snippet; hover the ⓘ in its header, or a cut-off company name, for a tooltip:

<Example name="custom-cells" title="A cell snippet and tooltips" />

## A cell snippet

Give the column `type: 'custom'` and pass a `cell` snippet to the grid: declared inside `<Grid>`, it is the `cell` prop, and its parameters get their types from it. It receives `{ row, column, value }`, so one snippet can serve several custom columns by checking `column.key`:

```svelte
<Grid {rows} {columns} height={400}>
  {#snippet cell({ row })}
    {@const change = Number(row.change)}
    <span class="move" class:up={change >= 0}>
      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
    </span>
  {/snippet}
</Grid>
```

## A component per column

Set `component` on any column. The component receives `value`, `row`, `column` and `text` (the value formatted as copy and export see it):

```ts
import StatusPill from './StatusPill.svelte';

const columns: ColumnDef[] = [
  { type: 'text', key: 'status', header: 'Status', component: StatusPill },
];
```

```svelte
<!-- StatusPill.svelte -->
<script lang="ts">
  import type { CellTypeProps } from 'bo-grid';
  let { value, text }: CellTypeProps = $props();
</script>

<span class="pill" data-status={value}>{text}</span>
```

The component updates in place as its props change. Under `api.patchRows`, `row` is a fresh view of the patched row on each patch, so read it reactively (in markup or `$derived`) rather than once when the component mounts.

A component is usually part of a [registered cell type](../column-types/#registered-cell-types), so every grid that shows, say, a country uses the same cell. The **Team** example below does that for its Country column.

## A render function

Snippets and components are Svelte features, so outside Svelte (the React and Vue components, or the `<bo-grid>` element) give the column a `render(ctx)` function. `ctx` is `{ value, row, column }`. Return a DOM node, which is appended as it is, or an HTML string:

```js
{
  type: 'custom',
  key: 'trend',
  header: 'Trend',
  render: ({ row }) => {
    const el = document.createElement('span');
    const up = Number(row.change) >= 0;
    el.textContent = up ? '▲' : '▼';
    el.style.color = up ? 'var(--bo-up)' : 'var(--bo-down)';
    return el;
  },
}
```

> An HTML string is inserted as `innerHTML`. If it contains data you do not control, escape it first (`escapeHTML` is exported) or return a node instead.

For text-only changes, a `format(value, row)` function is simpler than any of these, and it also changes what copy and export produce.

## Tooltips and truncation

Long values end in an ellipsis. Set `tooltip` on a column to show the full text in a styled tooltip on hover: `true` shows the formatted value, and a function builds the text from the value and the row. Return `''` to show no tooltip for a cell.

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'note', header: 'Notes', width: 220, tooltip: true },
  { type: 'badge', key: 'status', header: 'Status', tooltip: (value, row) => `${value} · ${row.role}` },
  { type: 'text', key: 'bio', header: 'Bio', flex: 1, wrap: true },
];
```

`wrap: true` lets a column's text wrap onto more lines instead of truncating; pair it with a taller [row height](../row-height/).

## Header tooltips

`headerTooltip` shows the same tooltip on a column's header: what the column means, its units, its caveats. Add `headerInfo: true` for a small ⓘ that shows a tooltip is there:

```ts
{
  type: 'progress',
  key: 'workload',
  header: 'Workload',
  headerTooltip: 'Share of capacity allocated this sprint (0–100%).',
  headerInfo: true,
}
```

## In the gallery

Rank medals and score bars drawn with custom cells:

<Example id="leaderboard" />

Rich cell types, a registered country type, tooltips and wrapping:

<Example id="team" />

## Reference

<Props names={['cell']} />

<Props of="column" names={['render', 'component', 'format', 'tooltip', 'wrap', 'headerTooltip', 'headerInfo']} />
