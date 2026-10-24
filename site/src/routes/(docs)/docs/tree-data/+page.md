---
title: Tree data
description: Show hierarchical rows as an expandable tree, from children you already have or loaded from a server on expand.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Tree data shows rows that contain rows: folders and files, an org chart, accounts and sub-accounts. Tell the grid how to find a row's children, and `rows` become the roots of an indented tree with a chevron on every row that has children.

Expand the folders with a click, or with <kbd>→</kbd> and <kbd>←</kbd> on the focused row.

<Example id="tree" />

## Children you already have

`getChildren` returns a row's children, or `undefined` (or an empty array) for a leaf:

```svelte
<script lang="ts">
  import { Grid, type GridRow } from 'bo-grid';

  let rows = $state<GridRow[]>([
    { id: 1, name: 'src', children: [{ id: 2, name: 'app.ts' }] },
    { id: 3, name: 'README.md' },
  ]);
</script>

<Grid {rows} {columns} height={520} getChildren={(r) => r.children as GridRow[] | undefined} />
```

The first column is indented by depth and carries the chevron. Every row in the tree needs an id unique across the whole tree, not just among its siblings.

In tree mode the grid shows the tree as given: filtering, sorting, grouping and pagination do not apply to it.

## Children loaded on expand

For a hierarchy too large to send up front, use `loadChildren` instead of `getChildren`. It returns a promise of a row's children and runs the first time the row is expanded; the grid shows a loading row meanwhile and keeps the children once loaded. Pair it with `hasChildren`, a cheap test that decides which rows get a chevron before anything loads:

```svelte
<Grid
  {rows}
  {columns}
  height={520}
  hasChildren={(r) => r.kind === 'folder'}
  loadChildren={(r) => fetch(`/api/children/${r.id}`).then((res) => res.json())}
/>
```

A server-backed tree, with a loading row on each first expand:

<Example id="lazytree" />

## Keyboard and screen readers

With tree data the grid takes the treegrid role: rows expose `aria-level` and `aria-expanded`, <kbd>→</kbd> expands a collapsed row and <kbd>←</kbd> collapses an expanded one. Other keys work as in a flat grid; see [Keyboard & hotkeys](../keyboard/).

## Reference

<Props names={['getChildren', 'loadChildren', 'hasChildren']} />
