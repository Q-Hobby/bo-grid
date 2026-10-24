---
title: Row styles
description: TODO
---

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
