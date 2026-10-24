---
title: Inline editing
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Mark a column `editable: true`. Double-click a cell (or press <kbd>Enter</kbd> on
the focused cell) to edit; <kbd>Enter</kbd>/blur commits, <kbd>Esc</kbd> cancels.
Or just start typing — a printable key on a focused editable cell opens the
editor seeded with that character (Excel-style type-to-edit). The editor matches
the column type: numeric columns get a number input, `date` columns a native date
picker, `options` columns a `<select>`, everything else a text input. The grid is
controlled, so it reports the change via `onCellEdit` — update your own row data
there:

```svelte
<Grid
  {rows}
  {columns}
  height={640}
  onCellEdit={(e) => (e.row[e.column.key] = e.value)}
/>
```

`e.value` is parsed to a number for numeric columns (invalid input is rejected),
otherwise the raw string. Make the edited field `$state` so the cell updates. Add
a column `validate(value, row)` to reject edits that fail your own rule (it
applies to paste too):

```ts
{ type: 'number', key: 'qty', header: 'Qty', editable: true, validate: (v) => v >= 0 }
```

Give an editable column `options` to edit it via a dropdown instead of a text
input (enum/status columns):

```ts
{ type: 'text', key: 'status', header: 'Status', editable: true,
  options: ['New', 'Active', 'Closed'] }
```

## Live example

<Example id="sheet" />
