---
title: Cell selection & clipboard
description: TODO
---

Click a cell, then drag or **Shift-click** to extend a rectangular selection.
Keyboard: **arrows** move, **Shift+arrows** extend, **Home/End** jump to the
first/last column (**+Ctrl/⌘** for the first/last cell), **PageUp/PageDown** move
by a page, **Ctrl/⌘+A** select all, **Ctrl/⌘+C** copy the selection as TSV
(Excel-pasteable), **Ctrl/⌘+V** paste, **Esc** clear.

**Hotkeys.** `hotkeys` binds keys for your app, run before the grid's own,
with the focused row and column:

```svelte
<Grid {rows} {columns} hotkeys={{
  b: ({ row }) => row && openTicket(row, 'buy'),
  s: ({ row }) => row && openTicket(row, 'sell'),
  Delete: ({ row }) => row && cancel(row),
  'Shift+C': () => cancelAll(),
  'Mod+K': () => openSearch(),        // Ctrl+K, or ⌘K on a Mac
  Enter: ({ row }) => (row?.locked ? undefined : false), // false: the grid's own Enter
}} />
```

A binding is a key (`'b'`, `'Delete'`, `'F2'`, `'Space'`) after any of
`Shift+`, `Alt+`, `Ctrl+`, `Meta+` and `Mod+` (Ctrl or ⌘, whichever is
pressed); case does not matter. A symbol is bound by the character it types
(`'?'`, not `'Shift+/'`, which throws). A letter also fires from its place on
the keyboard when the layout types another alphabet there. The row is null
when no data row has the focus. Keys go to the grid, not to a binding, while
a cell is being edited or an input, button or menu inside the grid has them;
a key a binding took runs it once when held down, so holding B opens one
ticket. A binding that cannot be read, or binds a key twice, throws when the
grid gets it.

**The focus stays on its row.** The selection and an open editor belong to
rows, not places. When rows are added, removed or reordered (a new `rows`
array, a row arriving above the focused one), the focus, the selected range
and the editor move with their rows, so a hotkey acts on the row you are
looking at and an edit is written to the row it was opened on. If the
focused row leaves, the selection clears; if the edited row leaves, the edit
closes unwritten. (In-memory rows; with a server `source`, rows are where the
source puts them.)

Paste writes a TSV block (from a spreadsheet or the grid's own copy) into
editable cells starting at the selection's top-left. A single copied value fills
the whole selection (Excel behaviour); a block clamps to the grid edges. Pasted
values flow through the same validation as inline editing — non-editable columns
and invalid numbers are skipped — and each accepted cell emits `onCellEdit`, so
paste only does anything when you've wired that callback.

Set `fillHandle` for an **Excel-style fill handle**: the selection grows a small
square at its bottom-right corner; drag it down or right to copy the selected
value(s) across the extended range (editable columns; multi-cell selections tile).

Edits, paste and fill are **undoable** with <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> (redo
with <kbd>Ctrl/⌘</kbd>+<kbd>Y</kbd>). A paste or fill undoes as a single step.

For a read-only / display grid, set `cellSelection={false}` to drop the blue
range-selection highlight (and fill handle) entirely — clicks pass straight
through to `onRowClick` / `onCellClick`:

```svelte
<Grid {rows} {columns} height={640} cellSelection={false} onRowClick={open} />
```

For a **list-detail / master-detail** layout, drive `selectedRowId` (keyed by
`getRowId`) to highlight the active row — independent of the checkbox selection:

```svelte
<Grid {rows} {columns} height={640}
  selectedRowId={active?.id} onRowClick={(r) => (active = r)} />
```

When more than one cell is selected, a footer bar shows live **Sum / Avg / Count /
Min / Max** over the numeric cells in the range — and it keeps updating as a
realtime feed ticks. Choose which stats to show:

```svelte
<Grid {rows} {columns} aggregations={['sum', 'avg', 'count']} height={640} />
```

Set `footer` for a **pinned totals row**: every column with a `groupAgg` shows
that aggregate over all (filtered) rows, sticky to the bottom as you scroll
(in-memory mode).

```svelte
<Grid {rows} {columns} height={640} footer />
```

The totals follow a live feed without rescanning every row: `api.patchRows`
moves them by the rows it changed, and rows edited any other way (`$state`
rows, an `onCellEdit` handler) update them as well. A computed column (`value`)
must depend only on its own row for this; one that reads other rows or the
clock gets a fresh total on the next new view or `api.refresh()`.

Pass `pinnedRows` to keep rows stuck to the **top**, always visible above the
scroll — a benchmark, a summary, or "your position". They render with the normal
columns (and `rowClass`) but are display-only:

```svelte
<Grid {rows} {columns} height={640} pinnedRows={[benchmark]} />
```

To let users pin rows themselves, such as the symbols they watch on a long
board, add **`rowPinning`**. Right-clicking a row then offers "Pin to top", and
on a pinned row "Unpin", ahead of any `rowMenu` items.
- A pinned row shows above the scroll and also stays in its place in the body.
  It keeps updating, `api.patchRows` included.
- Pins are remembered with `persistKey` and carried by `getState()` /
  `applyState()`.
- `onRowPinChange(ids)` reports changes. `api.pinRow(id, pinned?)` and
  `api.getPinnedRowIds()` do the same from code.

```svelte
<Grid {rows} {columns} rowPinning persistKey="watchlist" onRowPinChange={(ids) => save(ids)} />
```
