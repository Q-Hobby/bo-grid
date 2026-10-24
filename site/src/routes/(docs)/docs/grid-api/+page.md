---
title: Grid API
description: The grid's handle for actions that are not state, such as scrolling to a row, focusing a cell, saving a layout or patching live rows.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Most of the grid is driven by props: rows, columns, sort, filters. Some things are actions rather than state, with no resting value a prop could hold: scroll to this row, focus that cell, download the current view, save the layout. For those the grid hands you one object, the grid API, through `onReady`.

Each button calls one API method. Resize or move a column, then save the layout, change it again and restore it.

<Example name="grid-api" title="Calling the grid API" />

## Getting the handle

`onReady` is called once, when the grid mounts, with the API object:

```svelte
<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  let api = $state<GridApi>();
</script>

<button onclick={() => api?.scrollToRow('ORD-1042', 'center')}>Find order</button>
<Grid {rows} {columns} height={480} onReady={(a) => (api = a)} />
```

In React and Vue the same object is the component's ref (`ref.current` in React, the template ref's `api` in Vue); see [React, Vue & more](../frameworks/).

## Methods

| Method | What it does |
| --- | --- |
| `scrollToRow(id, align?)` | Scroll a row into view; `align` is `'nearest'` (default), `'start'`, `'center'` or `'end'` |
| `focusCell(rowId, columnKey)` | Focus and select one cell |
| `getFocusedCell()` | The focused `{ row, column }`, or `null` |
| `getSelectedRows()` | The ticked rows (with `rowSelection`), in view order |
| `autosizeColumns(keys?)` | Fit columns to their content, as the column menu's **Autosize** does |
| `exportCSV(filename?)` | Download the current view, after filters and sort, as CSV |
| `getState()` / `applyState(state)` | Save and restore the user's layout (below) |
| `patchRows(patches)` | Write live values into rows in place; see [Live updates](../realtime/) |
| `refresh()` | Re-run sort and filters against values changed in place |
| `flashCells(options?)` | Flash cells on demand; see [Cell flashing](../flashing/) |
| `pinRow(id, pinned?)` / `getPinnedRowIds()` | Pin rows above the scroll from code |
| `openFind(query?)` | Open the find bar (with `findBar`) |

Methods that look a row up by id (`scrollToRow`, `focusCell`) return `false` when the row is not in the current view: filtered out, on another page, or in a grid backed by a server `source`.

## Saving a layout

`getState()` returns the user's layout as one plain, JSON-safe object: column order, widths, hidden columns, pinned columns, pinned rows, sorts and filters. Keep it wherever you keep user settings, per user or per workspace, and give it back with `applyState(saved)`:

```ts
const saved = api.getState();
localStorage.setItem('orders-layout', JSON.stringify(saved));

// later
api.applyState(JSON.parse(localStorage.getItem('orders-layout') ?? 'null'));
```

`applyState` fits the saved layout onto the columns as they are now:

- Entries for columns that no longer exist are dropped.
- A new column lands where it is declared, after the nearest column declared before it.
- Malformed fields are ignored rather than thrown on.
- A state from another `version` of the format is refused whole (`applyState` returns `false`), because half a layout is worse than none.

The same rules are exported as `reconcileState(saved, columnKeys)`, for a server that wants to apply them itself. For the simple case, `persistKey` saves the layout in the browser's local storage with no code.

## Also exported

Besides `Grid` and its types, the package exports helpers you can use on their own:

| Group | Exports |
| --- | --- |
| Components | `Grid`, `Sparkline` |
| Formatting | `fmtPrice`, `fmtPercent`, `fmtVolume`, `fmtDate`, `fmtCurrency`, `relativeTime` |
| Data | `aggregate`, `pivot`, `sortRows`, `heatColor`, `resolveColumns`, `buildMergePlan`, `colSpanRow` |
| Export and import | `toCSV`, `exportCSV`, `exportXLSX`, `parseCSV`, `parseCSVMatrix`, `parseTSV`, `parseJSON`, `parseRows`, `rowsFromObjects`, `toHTMLTable`, `printTable`, `escapeHTML` |
| Server data | `createArraySource` |
| Theming and text | `themeVars`, `themePresets` and the preset token maps, `DEFAULT_LABELS`, `resolveLabels` |
| Layout state | `reconcileState`, `GRID_STATE_VERSION` |
| Canvas | `drawCandles`, `setupHiDpiCanvas` (draw candlesticks on a canvas of your own) |

Realtime and trading helpers live in their own entries, `bo-grid/realtime`, `bo-grid/trading` and `bo-grid/ladder`. Every prop and method, with its type, is in the [Props reference](../reference/).

## Reference

<Props names={['onReady', 'persistKey']} />

<Props of="api" names={['scrollToRow', 'focusCell', 'getFocusedCell', 'getSelectedRows', 'autosizeColumns', 'exportCSV', 'getState', 'applyState', 'patchRows', 'refresh', 'flashCells', 'pinRow', 'getPinnedRowIds', 'openFind']} />
