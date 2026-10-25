---
title: Row styles
description: Style rows and cells from their data with classes, react to a row being opened, and give rows a right-click menu.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Rows and cells take classes chosen from their data: `rowClass` for a whole row, a column's `cellClass` for its cells. The same page covers what a row does when used: `onRowClick` when it is opened, and `rowMenu` for its right-click menu.

Falling stocks are dimmed by `rowClass`, and big gains are bold through `cellClass`. Click a row, or right-click it for its menu:

<Example name="row-styles" title="Row classes, row click and a row menu" />

## Classes from the data

`rowClass(row)` returns a class for a data row, or nothing. Rows render inside the grid, so target the class with `:global(...)`:

```svelte
<Grid {rows} {columns} rowClass={(r) => (Number(r.change) < 0 ? 'falling' : undefined)} height={480} />

<style>
  :global(.bo-grid .row.falling) {
    opacity: 0.6;
  }
</style>
```

For one column, `cellClass` is a class string, or a function of the cell's value and row; `headerClass` styles the column's header:

```ts
{ type: 'number', key: 'pnl', header: 'P&L', cellClass: (v) => (Number(v) < 0 ? 'loss' : 'gain'), headerClass: 'num-head' }
```

```css
:global(.bo-grid .c.loss) { color: var(--bo-down); }
```

For colour cues that scale with the value, such as bars and heat tints, see [Conditional formatting](../conditional-formatting/).

## Opening a row

`onRowClick(row, event)` fires when a row is clicked, or when <kbd>Enter</kbd> is pressed on its focused cell. Clicks in an edit input or a checkbox don't count. Use it to open a detail view or navigate; to keep the opened row highlighted, pass its id as `selectedRowId` (see [Row selection](../row-selection/#one-active-row)).

## A row menu

`rowMenu(row)` returns the items of a right-click menu for that row; return an empty array for no menu. Each item has a `label` and an `onSelect`, and the menu closes after an item runs, on a click outside, or on <kbd>Esc</kbd>. From the keyboard, the <kbd>ContextMenu</kbd> key or <kbd>Shift</kbd>+<kbd>F10</kbd> opens it at the focused cell.

```svelte
<Grid {rows} {columns} rowMenu={(r) => [{ label: 'Delete', onSelect: () => remove(r.id) }]} height={480} />
```

## Reference

<Props names={['rowClass', 'onRowClick', 'selectedRowId', 'rowMenu']} />

<Props of="column" names={['cellClass', 'headerClass']} />
