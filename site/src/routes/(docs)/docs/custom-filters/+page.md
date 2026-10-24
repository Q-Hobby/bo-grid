---
title: Custom filters
description: Register a filter kind of your own, with its own editor in the column's filter menu, when text, number, date and set filters do not fit.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

The built-in filter menu covers text, numbers, dates and sets. When a column needs another rule (a band of values, a lot-size check, "within N km"), register a filter kind with `filterTypes` and point the column at it with `filter: 'name'`. The menu keeps its frame (title, **Clear**, **Apply**, Enter to apply), and your component edits the middle.

Open the funnel on **Chg %**: it shows a registered `move` filter that keeps rows by how far they moved.

<Example name="custom-filters" title="A registered filter kind" />

## Define the filter kind

A filter kind is a test, an optional "is it narrowing anything" check, and an editor component:

```ts
import type { CustomFilter, FilterTypeDef } from 'bo-grid';
import MoveEditor from './MoveEditor.svelte';

type Move = 'down' | 'flat' | 'up';

export interface MoveFilter extends CustomFilter {
  kind: 'move';
  moves: Move[];
}

const moveOf = (pct: number): Move => (pct < -0.5 ? 'down' : pct > 0.5 ? 'up' : 'flat');

export const move: FilterTypeDef<MoveFilter> = {
  component: MoveEditor,
  isActive: (f) => f.moves.length > 0,            // optional; by default always active
  test: (value, f) => f.moves.includes(moveOf(Number(value))),
};
```

`test(value, filter, row)` decides one cell and runs only while the filter is active.

## Register it

Pass the kinds to the grid by name, and select one on a column:

```svelte
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { move } from './move';

  const columns: ColumnDef[] = [
    { type: 'percent', key: 'change', header: 'Chg %', filter: 'move' },
    // …
  ];
</script>

<Grid {rows} {columns} height={480} filterMenu filterTypes={{ move }} />
```

## Write the editor

The editor gets the draft as `filter` (the active filter when the menu opened, or `null`) and calls `onChange(next)` as the user edits. **Apply** commits the draft when it is active, and **Clear** removes the filter. Pass `null` for "no filter".

```svelte
<script lang="ts">
  import type { FilterEditorProps } from 'bo-grid';
  import type { MoveFilter } from './move';

  let { filter, onChange }: FilterEditorProps<MoveFilter> = $props();
  const picked = $derived(new Set(filter?.moves ?? []));

  function toggle(id: 'down' | 'flat' | 'up') {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next.size ? { kind: 'move', moves: [...next] } : null);
  }
</script>

<label><input type="checkbox" checked={picked.has('up')} onchange={() => toggle('up')} /> Up more than 0.5%</label>
<!-- … -->
```

The editor also receives `column`, `labels` and, when the kind sets `needsValues: true`, the column's distinct values as `values` (as the set filter uses them).

## Saving and server sources

A custom filter is a plain object with a `kind`, so it goes through `columnFilters`, `onFilterChange` and `getState()` unchanged, and reaches a `RowSource` in `params.columnFilters`. To apply it in `createArraySource`, pass the same kinds:

```ts
const source = createArraySource(rows, { filterTypes: { move } });
```

A filter whose kind is not registered is treated as inactive: it filters nothing, rather than emptying the grid.

## Reference

<Props names={['filterTypes', 'filterMenu', 'columnFilters', 'onFilterChange']} />

<Props of="column" names={['filter']} />
