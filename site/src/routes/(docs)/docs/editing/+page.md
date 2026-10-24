---
title: Inline editing
description: Edit cells in place with an editor matched to the column type, validate the value, and write it back to your rows.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Mark a column `editable: true` and its cells can be edited in place. The grid is controlled: it never writes to your data itself, but reports each change through `onCellEdit`, where you update the row (or send the change to a server first).

Double-click a cell, press <kbd>Enter</kbd> on it, or select it and start typing. Status opens a dropdown, and Qty refuses a negative number.

<Example name="editing" title="Editable cells" />

## Making a column editable

```svelte
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'number', key: 'qty', header: 'Qty', editable: true },
    { type: 'text', key: 'note', header: 'Note', editable: true },
  ];
  let rows = $state(initialRows);
</script>

<Grid {rows} {columns} height={480} onCellEdit={(e) => (e.row[e.column.key] = e.value)} />
```

Keep the rows in `$state` so the cell shows the new value once you write it. The event carries the `row`, the `column` and the new `value`.

## Opening and closing the editor

- Double-click a cell, or press <kbd>Enter</kbd> or <kbd>F2</kbd> on the focused cell.
- Start typing on a focused cell: the editor opens with that character, as in a spreadsheet. (Date and dropdown editors open with <kbd>Enter</kbd> or a double-click.)
- <kbd>Enter</kbd> or leaving the cell saves; <kbd>Tab</kbd> saves and moves to the next cell (on to the next row at the end of one); <kbd>Escape</kbd> cancels. The grid keeps the keyboard afterwards.
- Picking an option in a dropdown with the pointer saves at once; with the arrow keys, <kbd>Enter</kbd> saves.
- What you type is yours until you save: a live update to the cell does not overwrite it.

## The editor for each type

The editor matches the column:

| Column | Editor | `e.value` |
| --- | --- | --- |
| Number types (`number`, `price`, `percent`, `volume`, `currency`, `heatmap`) | a text input with a numeric keypad, so `-` and `.` type as expected | a number; a blank, or text that is not a number, is refused |
| `date` | the browser's date picker | epoch milliseconds |
| Any column with `options` | a dropdown | the chosen string |
| Everything else | text input | the typed string |

Display widgets (`badge`, `tags`, `rating`, `progress` and others) and computed columns (`value`) are not editable by themselves; give a display column an `editor` to edit it. See [Custom editors](../custom-editors/).

## Dropdowns

Give an editable column `options` to pick from a list instead of typing:

```ts
{ type: 'text', key: 'status', header: 'Status', editable: true, options: ['New', 'Active', 'Closed'] }
```

## Validation

`validate(value, row)` runs before a value is saved; return `false` to refuse it and keep the old value. It sees the parsed value (a number for a number column), and it applies to paste and the fill handle too:

```ts
{ type: 'number', key: 'qty', header: 'Qty', editable: true, validate: (v) => Number(v) >= 0 }
```

To turn typed text into a value yourself (strip a currency sign, read "1.5k"), use `parse`; see [Custom editors](../custom-editors/).

## Undo, paste and fill

Edits, pastes and fills undo with <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> and redo with <kbd>Ctrl/⌘</kbd>+<kbd>Y</kbd> (or <kbd>Ctrl/⌘</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>); a paste or a fill is one step. Paste and the fill handle write through the same validation and call `onCellEdit` for every cell they change. See [Cell selection & clipboard](../selection/).

## A full spreadsheet

Dropdowns, parsed salaries, a date editor, the fill handle and saved layouts together:

<Example id="sheet" />

## Reference

<Props names={['onCellEdit', 'fillHandle']} />

<Props of="column" names={['editable', 'options', 'validate', 'parse', 'editor']} />
