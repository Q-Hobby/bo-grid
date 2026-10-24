---
title: Grid API
description: TODO
---

`onReady` hands you one object for the things that are *actions* rather than
state — they have no resting value to express them as a prop. It is called once,
when the grid mounts.

```svelte
<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  let api: GridApi | undefined;
</script>

<Grid {rows} {columns} onReady={(a) => (api = a)} />
<button onclick={() => api?.scrollToRow('ORD-1042', 'center')}>Find order</button>
```

| Method | What it does |
| --- | --- |
| `scrollToRow(key, align?)` | Scroll a row (by `getRowId`) into view; `align` is `'nearest'` (default), `'start'`, `'center'` or `'end'`. `false` when the row is not in the current view — filtered out, on another page, or in a `source` grid |
| `focusCell(rowKey, columnKey)` | Focus and select one cell. `false` when the row or column is not visible |
| `getFocusedCell()` | `{ row, column }` of the focused cell, or `null` when no data cell has focus. For hotkeys that act on the row the user is on |
| `getSelectedRows()` | Ticked rows (needs `rowSelection`), in view order |
| `autosizeColumns(keys?)` | Fit columns to their content, as the column menu's **Autosize** does |
| `exportCSV(filename?)` | Download the **current view** (after filter and sort); the writer loads on demand |
| `getState()` · `applyState(s)` | The user's whole layout as one plain object — see below |

**Saving a layout.** `getState()` returns the column order, widths, runtime
hidden columns, pin overrides, sorts and filters. It is JSON-safe, so keep it
wherever you keep user settings. `applyState(saved)` fits it onto the columns as
they are *now*: entries for columns that no longer exist are dropped, a column
that is new lands where it is declared (after the nearest column declared before
it), and malformed fields are ignored rather than thrown on. A state from a
different `version` is refused whole — `applyState` returns `false` — because half
a layout is worse than none. The fitting rules are exported as
`reconcileState(saved, columnKeys)` for a backend that wants to apply them
itself.

`persistKey` still works as before for the browser-local convenience case; the
handle is for layouts you store yourself (per user, per workspace).

## Also exported

`Sparkline` component · `drawCandles` / `setupHiDpiCanvas` (draw on your own
canvas) · `fmtPrice` / `fmtPercent` / `fmtVolume` / `fmtDate` · `heatColor` ·
`Selection` · `aggregate` · `toCSV` / `exportCSV` / `exportXLSX` / `rowsToMatrix` ·
`parseCSV` / `parseCSVMatrix` / `parseTSV` / `parseJSON` / `parseRows` /
`rowsFromObjects` · `toHTMLTable` / `printTable`.
