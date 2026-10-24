---
title: Find in grid
description: A find bar on Ctrl/⌘+F that searches the cells' displayed text and steps through every match.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

`findBar` turns on Ctrl/⌘+F inside the grid: a small bar opens over the top-right corner and finds text in the cells, as a browser finds text in a page, including rows that are scrolled out of view. Unlike a filter, it hides nothing.

Press the button, or click a cell and press Ctrl/⌘+F, then Enter to step through the matches.

<Example name="find" title="Find bar" />

## Turning it on

```svelte
<Grid {rows} {columns} height={480} findBar />
```

It is off by default, because while the grid has focus it takes Ctrl/⌘+F from the browser.

## How it searches

- It matches what the cells show (their formatted text), ignoring case, and counts the matches ("3 of 12").
- <kbd>Enter</kbd> and <kbd>Shift</kbd>+<kbd>Enter</kbd> step through them; each match is focused and scrolled into view.
- <kbd>Escape</kbd> closes the bar and returns focus to the grid.
- It searches in-memory rows (not a `source`), up to 10,000 matches.

Matches are found once per query and view, not on every tick, so on a live board the values can move after the bar has found them.

## Opening it from code

`api.openFind(query?)` opens the bar from your own button or shortcut, and searches for `query` at once when you give one:

```svelte
<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  let api = $state<GridApi>();
</script>

<button onclick={() => api?.openFind('Financials')}>Find</button>
<Grid {rows} {columns} height={480} findBar onReady={(a) => (api = a)} />
```

To narrow the rows instead of finding them, use the quick search in [Sorting & filtering](../sorting-filtering/).

## Reference

<Props names={['findBar']} />

<Props of="api" names={['openFind']} />
