---
title: Server-side data
description: Back the grid with a row source that serves only the rows in view, so the dataset can be millions of rows on a server.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Instead of an array of rows, a grid can read from a **row source**: an object with one method, `getRows`, that returns a window of rows for the current sort and filter. The grid asks only for the rows in view (plus a small buffer), so the full dataset never has to be in the browser. Rows not loaded yet show as placeholders.

50,000 orders behind a source that answers after 300 ms, like a server. Scroll fast, sort a column, or search.

<Example name="server-data" title="A row source" />

## Writing a source

`getRows` gets the range to load, the sort and the filters, and returns the rows of that range with the total row count (which sizes the scrollbar). It can return the result directly or as a promise:

```svelte
<script lang="ts">
  import { Grid, type RowSource } from 'bo-grid';

  const source: RowSource = {
    async getRows({ range, sorts, filter, quickFilter, columnFilters }) {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offset: range.start, limit: range.end - range.start, sorts, filter, quickFilter, columnFilters }),
      });
      return res.json(); // { rows, total }
    },
  };
</script>

<Grid rows={[]} {columns} {source} height={640} />
```

`rows` is required by the types; pass an empty array in source mode.

| Parameter | Meaning |
| --- | --- |
| `range` | `{ start, end }`: row indexes to return, `end` exclusive |
| `sorts` | The full sort order, primary first (may be empty) |
| `sort` | The primary sort, or `null`, for sources that sort by one column |
| `filter` | The grid's `filter` text |
| `quickFilter` | The text in the built-in search box (`quickFilter`); a row should match both |
| `columnFilters` | The column filters from the filter menu, by column key |

When the sort or a filter changes, the grid drops what it has loaded and asks again, on every change of the search text too: debounce in your source if your server needs fewer requests. A slow answer to an old request is ignored once a newer one is out.

## What runs where

- **Sorting and filtering** belong to the source: header sorts and the text, number and date filter menus are sent to `getRows`. The built-in search box sends its text as `quickFilter`, and your own search input can pass `filter`, as the example does. The filter row is for in-memory data. A set filter needs the column's values, so it is for in-memory data too.
- **Grouping, tree data, the totals row, the fill handle and find** work on in-memory rows and are not applied in source mode.
- `api.scrollToRow` and `api.focusCell` look rows up by id among in-memory rows, so in source mode they return `false`.

## An in-memory source

`createArraySource(rows, options)` wraps an array in the same interface. It is handy for trying the source path, for tests, and as a client-side adapter:

```ts
import { createArraySource } from 'bo-grid';

const source = createArraySource(allRows, {
  latency: 300,                     // pretend to be a server (ms)
  filterKeys: ['order', 'symbol'],  // fields the `filter` text searches
});
```

It applies the sorts and column filters, searches `filterKeys` for the `filter` and `quickFilter` text (no `filterKeys`: no text search), and slices the range. Pass `filterTypes` to apply [custom filters](../custom-filters/) too.

## A million rows

A trade tape of a million rows, windowed from a synthetic source on demand:

<Example id="bigdata" />

## Reference

<Props names={['source', 'filter', 'loading']} />
