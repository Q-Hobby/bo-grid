---
title: Custom filters
description: TODO
---

When the built-in controls don't fit — a capacity band, a lot-size rule, a
"within N km" check — register your own kind with `filterTypes`, and point a
column at it with `filter: 'name'`. The menu keeps its frame (title, **Clear** /
**Apply**, Enter to apply); your editor draws the middle and edits a draft:

```ts
import type { CustomFilter, FilterTypeDef } from 'bo-grid';
import BandEditor from './BandEditor.svelte';

interface BandFilter extends CustomFilter { kind: 'band'; bands: string[] }
const band: FilterTypeDef<BandFilter> = {
  component: BandEditor,                       // receives { filter, onChange, column, values, labels }
  isActive: (f) => f.bands.length > 0,         // optional; default: always active
  test: (value, f) => f.bands.includes(bandOf(Number(value))),
};
```

```svelte
<Grid {rows} {columns} filterMenu filterTypes={{ band }} />
<!-- column: { type: 'progress', key: 'workload', header: 'Workload', filter: 'band' } -->
```

The editor gets the draft as `filter` (the active filter when the menu opened,
or `null`) and calls `onChange(next)` as the user edits; **Apply** commits the
draft when it is active, **Clear** removes it. Set `needsValues: true` to receive
the column's distinct values as `values`, as the set filter does. A custom filter
is a plain object with a `kind`, so it round-trips through `columnFilters`,
`onFilterChange`, `getState()` and a `RowSource` unchanged — pass the same
`filterTypes` to `createArraySource` to apply it there. A filter whose kind is
not registered filters nothing, rather than silently emptying the grid.

Sorting is uncontrolled by default. To own it (persist it, set an initial sort,
or sync to the URL), pass a controlled `sort` array and handle `onSortChange`:

```svelte
<Grid {rows} {columns} height={640} {sort} onSortChange={(s) => (sort = s)} />
```
