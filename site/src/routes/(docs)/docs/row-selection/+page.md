---
title: Row selection
description: TODO
---

Set `rowSelection` for a leading checkbox column — whole-row selection keyed by
`row.id`, so it survives sorting and filtering (unlike the positional cell
selection above). The header checkbox selects/clears all matching rows, and
<kbd>Space</kbd> toggles the focused row from the keyboard.
`onRowSelectionChange` reports the selected ids:

```svelte
<Grid
  {rows}
  {columns}
  height={640}
  rowSelection
  onRowSelectionChange={(ids) => (selected = ids)}
/>
```

In server (`source`) mode the per-row checkboxes work on loaded rows; the
select-all header checkbox is disabled (unloaded ids can't be enumerated).

Selection keys off `row.id` by default; pass `getRowId` for string/UUID/composite
keys (`getRowId={(r) => r.uuid}`).
