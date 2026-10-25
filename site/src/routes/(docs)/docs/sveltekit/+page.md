---
title: SvelteKit & SSR
description: Use bo-grid in SvelteKit with no setup, render the grid on the server, load rows in a load function, and add a live feed in the browser.
---

bo-grid renders on the server: `<Grid>` produces its HTML without touching `window`, `document` or `localStorage`, then hydrates in the browser. There is no `browser` guard, no client-only import and no stylesheet to add. A CI check (`pnpm ssr`) server-renders the grid on every build to keep it that way.

## Install

```sh
npm i bo-grid
```

Svelte 5 is a peer dependency, already in a SvelteKit app. Excel export is optional: install `xlsx` only if you call `exportXLSX`. It loads as a separate chunk the first time you export, so it never weighs on your main bundle.

## A first page

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 120 },
    { type: 'price', key: 'price', header: 'Price', width: 100 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90 },
  ];

  const rows = [
    { id: 1, symbol: 'VNM', price: 68.5, change: 1.2 },
    { id: 2, symbol: 'FPT', price: 132, change: -0.4 },
  ];
</script>

<Grid {rows} {columns} height={640} ariaLabel="Watchlist" />
```

No `onMount` and no `{#if browser}`: the table is in the server-rendered HTML, which helps first paint and crawlers.

## Rows from a load function

Fetch the rows on the server, or in a universal `load`, and pass them in. Keep the column definitions in the component:

```ts
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('https://api.example.com/quotes');
  return { rows: await res.json() };
};
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const columns: ColumnDef[] = [/* … */];
</script>

<Grid rows={data.rows} {columns} height={640} />
```

The import helpers are plain functions with no DOM, so they work in `load` too. `rowsFromObjects` gives each object an `id` (its index, unless it has one), and `parseCSV` turns CSV text into rows typed by your columns:

```ts
import { parseCSV, rowsFromObjects } from 'bo-grid';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const quotes = rowsFromObjects(await (await fetch('/api/quotes')).json());
  const history = parseCSV(await (await fetch('/data/history.csv')).text(), columns);
  return { quotes, history };
};
```

## A live feed in the browser

The grid renders on the server, but a feed is a browser concern: open the socket in `onMount`. Keep the rows as plain objects, write each batch of ticks with `api.patchRows`, and let columns with `flash: 'auto'` flash every change:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';

  let { data } = $props();
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'price', key: 'price', header: 'Price', flash: 'auto' },
  ];
  let api: GridApi | undefined;

  onMount(() => {
    const stream = createTickStream<number, { price: number }>({ apply: (batch) => api?.patchRows(batch) });
    stream.start();
    const ws = new WebSocket('wss://feed.example.com');
    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      stream.push(tick.id, { price: tick.price });
    };
    return () => {
      ws.close();
      stream.stop();
    };
  });
</script>

<Grid rows={data.rows} {columns} onReady={(a) => (api = a)} height={640} />
```

`patchRows` changes fields of existing rows. To add, remove or reorder rows, assign a new array: `rows = [...rows, newRow]`. See [Live updates](../realtime/) and [Tick streams](../tick-stream/).

## Saved layouts

`persistKey` saves the user's column order, widths, hidden and pinned columns in `localStorage`. It is safe to set unconditionally: on the server it does nothing, and the layout comes back in the browser.

```svelte
<Grid {rows} {columns} height={640} persistKey="watchlist" />
```

## Large and server-backed data

For data too large to send at once, back the grid with a `RowSource` that fetches windows of rows, or load tree children and groups when they are expanded. All of these are `fetch`-based, so they fit SvelteKit's data loading, and the first page can still be server-rendered from `load`:

```svelte
<!-- Server-side groups: totals up front, rows when a group opens -->
<Grid
  {columns}
  rows={[]}
  lazyGroups={data.groups}
  loadGroup={(key) => fetch(`/api/orders?group=${key}`).then((r) => r.json())}
  height={560}
/>
```

See [Server-side data](../server-data/), [Tree data](../tree-data/) and [Server-side grouping](../server-grouping/).

## Printing and export

Printing and export are user actions: call them from an event handler. `printTable` opens the browser's print window, and the export helpers download a file:

```svelte
<script lang="ts">
  import { exportCSV, printTable } from 'bo-grid';
</script>

<button onclick={() => printTable(rows, columns, { title: 'Report' })}>Print</button>
<button onclick={() => exportCSV('rows.csv', rows, columns)}>Export CSV</button>
```

See [Export & import](../export/).

## Notes

- **Styles** come with the component; there is nothing to import. Change the look with the `theme` prop or `--bo-grid-*` CSS variables (see [Theming](../theming/)).
- **Vite** needs no special configuration. If Vite warns about optimizing `xlsx`, install it or add it to `optimizeDeps.exclude`.
- **Use `Grid`, not the custom element.** In SvelteKit, import the `Grid` component: it is the smallest build and the only one that takes snippets. `bo-grid/element` is for apps that are not written in Svelte (see [React, Vue & more](../frameworks/)).
