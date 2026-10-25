---
title: Keyboard & hotkeys
description: The grid's full keyboard model, and hotkeys of your own that act on the focused row, such as B to buy and Delete to cancel.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

The grid is one tab stop: <kbd>Tab</kbd> moves focus into it, and keys move within it, as in a spreadsheet. On top of the grid's own keys, `hotkeys` binds keys for your app (B to buy, S to sell, Delete to cancel) and hands each binding the row the user is on.

Click a row, then press <kbd>B</kbd>, <kbd>S</kbd> or <kbd>Delete</kbd>; <kbd>Shift</kbd>+<kbd>R</kbd> brings the removed rows back.

<Example name="keyboard" title="Hotkeys on the focused row" />

## The grid's keys

| Keys | Action |
| --- | --- |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | Move the focused cell |
| <kbd>Shift</kbd> + arrows | Extend the selection |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last column; with <kbd>Ctrl/⌘</kbd>, the first / last cell |
| <kbd>PageUp</kbd> / <kbd>PageDown</kbd> | Move by a page of rows |
| <kbd>Enter</kbd> | Edit the focused cell, or run `onRowClick` on a read-only one |
| <kbd>F2</kbd> | Edit the focused cell |
| A printable key | Start editing the focused cell with that character |
| <kbd>Space</kbd> | Tick the focused row (with `rowSelection`) |
| <kbd>Ctrl/⌘</kbd>+<kbd>A</kbd> / <kbd>C</kbd> / <kbd>V</kbd> | Select all / copy / paste |
| <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd> | Undo / redo an edit, paste or fill |
| <kbd>Ctrl/⌘</kbd>+<kbd>F</kbd> | Open the find bar (with `findBar`) |
| <kbd>Alt</kbd>+<kbd>↓</kbd> | Open the column menu (with `columnMenu`) |
| <kbd>ContextMenu</kbd> / <kbd>Shift</kbd>+<kbd>F10</kbd> | Open the row menu (with `rowMenu` or `rowPinning`) |
| <kbd>→</kbd> / <kbd>←</kbd> on a tree row | Expand / collapse it |
| <kbd>Enter</kbd> / <kbd>Space</kbd> / <kbd>→</kbd> / <kbd>←</kbd> on a group header | Toggle / expand / collapse the group |
| <kbd>Escape</kbd> | Clear the selection, or close a menu |

While a cell is being edited, keys belong to the editor: <kbd>Enter</kbd> saves, <kbd>Tab</kbd> saves and moves to the next cell (<kbd>Shift</kbd>+<kbd>Tab</kbd>: the previous one), and <kbd>Escape</kbd> cancels. Each of them gives the keyboard back to the grid. Headers are focusable too: <kbd>Enter</kbd> or <kbd>Space</kbd> sorts, with <kbd>Shift</kbd> to add a sort key. Menus follow the usual menu pattern (arrows move, <kbd>Enter</kbd> chooses, <kbd>Escape</kbd> closes and returns focus). Screen-reader semantics are in [Accessibility](../accessibility/).

## Hotkeys

`hotkeys` maps a binding to a handler. Bindings run before the grid's own keys, and each handler gets the focused `row` and `column` (`null` when there is none) and the `event`:

```svelte
<script lang="ts">
  import { Grid, type Hotkeys } from 'bo-grid';

  const hotkeys: Hotkeys = {
    b: ({ row }) => { if (row) openTicket(row, 'buy'); },
    s: ({ row }) => { if (row) openTicket(row, 'sell'); },
    Delete: ({ row }) => { if (row) cancel(row); },
    'Shift+C': () => cancelAll(),
    'Mod+K': () => openSearch(), // Ctrl+K, or ⌘K on a Mac
  };
</script>

<Grid {rows} {columns} height={480} {hotkeys} />
```

### Writing a binding

- A binding is a key (`'b'`, `'Delete'`, `'F2'`, `'Space'`, `'Enter'`) after any of `Shift+`, `Alt+`, `Ctrl+`, `Meta+` and `Mod+` (Ctrl or ⌘, whichever is pressed). Case does not matter.
- A symbol is bound by the character it types: `'?'`, not `'Shift+/'` (which throws).
- A letter also fires from its place on the keyboard when the layout types another alphabet there, so B still works on a Cyrillic or Greek layout.
- A binding that cannot be read, or a key bound twice, throws when the grid gets the map.

### When a binding runs

- Return `false` from a handler to leave the key to the grid, for example to keep the grid's own <kbd>Enter</kbd> on some rows: `Enter: ({ row }) => (row?.locked ? undefined : false)`.
- Keys go to the grid, not to a binding, while a cell is being edited, or while an input, button or menu inside the grid has them.
- A held-down key runs its binding once, so holding <kbd>B</kbd> opens one ticket.

## The focus stays on its row

The selection and an open editor belong to rows, not to positions. When rows are added, removed or reordered (a new `rows` array, a row arriving above the focused one), the focus, the selected range and the editor move with their rows. A hotkey acts on the row the user is looking at, and an edit is written to the row it was opened on. If the focused row goes away, the selection clears; if the edited row goes away, the edit closes unsaved. (With a server `source`, rows are where the source puts them.)

`api.getFocusedCell()` returns the same `{ row, column }` from code, and `api.focusCell(rowId, columnKey)` moves the focus.

## Reference

<Props names={['hotkeys', 'onRowClick', 'rowMenu', 'ariaLabel']} />

<Props of="api" names={['getFocusedCell', 'focusCell']} />
