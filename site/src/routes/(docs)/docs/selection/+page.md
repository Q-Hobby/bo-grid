---
title: Cell selection & clipboard
description: Select ranges of cells, copy and paste them as spreadsheet text, fill with a drag handle, and see live totals for a selection or the whole grid.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Cells select like a spreadsheet: click a cell, then drag or Shift-click to select a rectangle. A selection copies as tab-separated text that pastes into a spreadsheet, and text from a spreadsheet pastes back into editable cells. A footer shows live statistics for the selected numbers.

Drag across Price and Qty to see the sum and average below the grid, copy with Ctrl/⌘+C, or drag the small square at the selection's corner down to fill. The pinned last row totals every column.

<Example name="selection" title="Range selection, fill and totals" />

## Selecting

- Click a cell; drag or <kbd>Shift</kbd>-click to extend to a rectangle.
- <kbd>Shift</kbd>+arrows extend from the keyboard, and <kbd>Ctrl/⌘</kbd>+<kbd>A</kbd> selects everything.
- <kbd>Escape</kbd> clears the selection.

The full key map is in [Keyboard & hotkeys](../keyboard/).

## Copy and paste

<kbd>Ctrl/⌘</kbd>+<kbd>C</kbd> copies the selection as tab-separated text, which a spreadsheet pastes as cells. <kbd>Ctrl/⌘</kbd>+<kbd>V</kbd> pastes such a block into editable cells, starting at the selection's top-left corner:

- A single copied value fills the whole selection.
- A block is cut off at the grid's edges.
- Values go through the same checks as typing: cells in columns that are not editable, and values that `parse` or `validate` refuse, are skipped.
- Every accepted cell calls `onCellEdit`, so paste does nothing until you handle that callback. See [Inline editing](../editing/).

## Fill handle

`fillHandle` puts a small square on the selection's bottom-right corner. Drag it down or right to copy the selected values over the cells you drag across, as a spreadsheet does; a multi-cell selection repeats as a pattern. Only editable columns are filled, in-memory data only.

```svelte
<Grid {rows} {columns} height={480} fillHandle onCellEdit={(e) => (e.row[e.column.key] = e.value)} />
```

Edits, pastes and fills undo with <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> and redo with <kbd>Ctrl/⌘</kbd>+<kbd>Y</kbd>; a paste or a fill undoes as one step.

## Totals for a selection

When more than one cell is selected, a bar under the grid shows **Sum**, **Avg**, **Count**, **Min** and **Max** of the numbers in the range, and keeps them current as a live feed ticks. `aggregations` picks which to show:

```svelte
<Grid {rows} {columns} height={480} aggregations={['sum', 'avg', 'count']} />
```

## A totals row

`footer` pins a totals row to the bottom: every column with a `groupAgg` shows that aggregate over all rows that pass the filters. In-memory data only.

```ts
const columns: ColumnDef[] = [
  { type: 'number', key: 'qty', header: 'Qty', groupAgg: 'sum' },
  { type: 'price', key: 'price', header: 'Price', groupAgg: 'avg' },
];
```

```svelte
<Grid {rows} {columns} height={480} footer />
```

The totals follow a live feed without rescanning every row: `api.patchRows` moves them by the rows it changed, and rows changed any other way (`$state` rows, an `onCellEdit` handler) update them too. A computed column must depend only on its own row for this; one that reads other rows or the clock gets a fresh total on the next view or `api.refresh()`.

## Read-only grids and an active row

For a display grid, `cellSelection={false}` drops the selection highlight and the fill handle, so clicks go straight to `onRowClick` and `onCellClick`:

```svelte
<Grid {rows} {columns} height={480} cellSelection={false} onRowClick={(row) => open(row)} />
```

For a list beside a detail view, drive `selectedRowId` (by `getRowId`) to highlight the active row. It is separate from the cell selection and from checkbox [row selection](../row-selection/):

```svelte
<Grid {rows} {columns} height={480} selectedRowId={active?.id} onRowClick={(row) => (active = row)} />
```

## Pinned rows

Rows can stay above the scroll, whether rows of your own (`pinnedRows`) or rows readers pin from the row menu (`rowPinning`): see [Pinned rows](../pinned-rows/).

## Reference

<Props names={['cellSelection', 'fillHandle', 'aggregations', 'footer', 'selectedRowId', 'onRowClick', 'onCellClick', 'onCellEdit']} />

<Props of="column" names={['groupAgg', 'editable']} />

<Props of="api" names={['pinRow', 'getPinnedRowIds']} />
