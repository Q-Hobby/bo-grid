---
title: Tree data
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Pass `getChildren` to render hierarchical rows — `rows` become the roots, and each
node gets an indented first column with an expand chevron when it has children:

```svelte
<Grid {rows} {columns} height={520} getChildren={(r) => r.children} />
```

In tree mode the grid renders the tree directly (filter/sort/group/paginate are
not applied to it). Nodes are keyboard-accessible: **→** expands a collapsed node,
**←** collapses an expanded one, and rows expose `aria-level` / `aria-expanded`.

## Lazy (server-backed) trees

For hierarchies too large to ship upfront, use **`loadChildren`** (async) instead
of `getChildren`. Children load on first expand — the grid shows a loading row,
then caches them. Pair it with **`hasChildren`** (a cheap predicate) so the chevron
shows without loading. See the **Lazy tree** example.

```svelte
<Grid
  {rows}
  {columns}
  height={520}
  hasChildren={(r) => r.kind === 'folder'}
  loadChildren={(r) => fetch(`/api/children/${r.id}`).then((res) => res.json())}
/>
```

## Live example

<Example id="tree" />

<Example id="lazytree" />
