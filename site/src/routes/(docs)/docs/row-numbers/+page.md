---
title: Row numbers
description: Add a spreadsheet-style row-number column that follows sorting and filtering and is announced by screen readers.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

`rowNumbers` adds a leading column that numbers the rows 1, 2, 3…, as in a spreadsheet. The numbers are positions in the current view, not ids, so they follow sorting and filtering.

Sort any column: the rows move and the numbers stay in order.

<Example name="row-numbers" title="Row numbers" />

## Turning it on

```svelte
<Grid {rows} {columns} rowNumbers height={480} />
```

- Data rows are numbered; group header rows get no number.
- The column stays in place when the grid scrolls sideways, and it is sized to the widest number.
- Its cells are row headers, so a screen reader announces the row's number with each cell. The column's header reads "Row", the `rowNumber` entry in [`labels`](../localization/).

## Reference

<Props names={['rowNumbers', 'labels']} />
