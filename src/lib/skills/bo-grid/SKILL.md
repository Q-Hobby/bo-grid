---
name: bo-grid
description: Writes and fixes code that uses bo-grid, the Svelte 5 data grid for trading screens. Use when code imports bo-grid (or bo-grid/realtime, bo-grid/trading, bo-grid/ladder, bo-grid/react, bo-grid/vue, bo-grid/element), or when asked for a table, price board, order book, blotter or live-updating grid in this project.
---

# bo-grid

bo-grid is a data grid built for trading screens: thousands of rows that
update many times a second. It is a Svelte 5 component, with React and Vue
components and a `<bo-grid>` custom element for other frameworks. All of
them take the same props.

## Read before you write

Your memory of bo-grid may be from another version. The installed package
carries the docs of its own version:

1. `node_modules/bo-grid/dist/docs/README.md`: the facts to get right, then
   every docs page as a Markdown file. Read the page for the feature you are
   building (`realtime.md`, `editing.md`, `grouping.md`…).
2. `node_modules/bo-grid/dist/docs/api.json`: every `<Grid>` prop, column
   option and API method, with its type, default and an example. If a name is
   not there or in the types in `node_modules/bo-grid/dist`, it does not
   exist: do not invent a plausible one.

Online, for the latest release: https://bonguynvan.github.io/bo-grid/llms.txt

## Entry points

Each export lives in exactly one place:

| Import from | What |
| --- | --- |
| `bo-grid` | `Grid`, column and row types, helpers |
| `bo-grid/realtime` | `createTickStream`, `serveFeed`/`connectFeed`, `createOrderBook`, `createAlerts`, `createLinger`, `TradeTape` |
| `bo-grid/trading` | tones, price bands, tick sizes, sessions, FX pips, `createPositions` |
| `bo-grid/ladder` | `DepthLadder`, a price ladder with click-to-trade |
| `bo-grid/react`, `bo-grid/vue` | `BoGrid` as a React or Vue component |
| `bo-grid/element` | the `<bo-grid>` custom element |

## Rules

- **Svelte 5 only:** runes (`$state`, `$derived`, `$props`), snippets and
  callback props. Never `export let`, `on:click`, `<slot>` or `bind:api`.
- **`height` is required** on `<Grid>`.
- **Rows** are plain objects with a unique `id`, a number or a string. If
  the data has another key, pass `getRowId`. Row fields are `unknown` to
  TypeScript: convert before arithmetic (`Number(row.qty)`).
- **Columns** are a `ColumnDef[]`. `type` picks the format and the options
  TypeScript allows; `key` is the column's identity, so keep keys unique.
- **The grid API** comes from `onReady={(api) => ...}` in Svelte, and from the
  component's ref in React and Vue.
- **Live prices:** give the column `flash: 'auto'` and write the new value.
  Never write `flashSeq` or `flashDir`. For a busy feed, keep rows as plain
  objects (`$state.raw`) and write ticks with `api.patchRows`, fed by
  `createTickStream`. `patchRows` only changes rows that exist: to add,
  remove or reorder rows, assign a new array.
- **Custom cells:** a `cell` snippet in Svelte; a column's `render(ctx)`
  function in React, Vue and the custom element.
- **Colours inside a cell:** read the theme's resolved variables, such as
  `var(--bo-up)` and `var(--bo-down)`.
- **Errors:** a bo-grid error starts with a code (`BG2004: ...`), also on
  `error.code`, and ends with `Fix:` and a link. Apply the fix as written.

## A first grid

```svelte
<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'price', key: 'last', header: 'Last', flash: 'auto' },
    { type: 'volume', key: 'volume', header: 'Volume' },
  ];
  let rows: GridRow[] = $state([
    { id: 1, symbol: 'AAPL', last: 227.5, volume: 51_200_000 },
    { id: 2, symbol: 'MSFT', last: 415.1, volume: 18_900_000 },
  ]);
</script>

<Grid {rows} {columns} height={400} />
```

## A live price board

```svelte
<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';

  interface Quote extends GridRow {
    id: string; // the symbol
    last: number;
  }
  const columns: ColumnDef[] = [
    { type: 'text', key: 'id', header: 'Symbol', width: 100 },
    { type: 'price', key: 'last', header: 'Last', flash: 'auto' },
  ];
  let rows: Quote[] = $state.raw([{ id: 'AAPL', last: 227.5 }]); // plain objects: the grid writes the ticks
  let api: GridApi | undefined;
  const stream = createTickStream<string, Partial<Quote>>({
    apply: (batch) => api?.patchRows(batch), // one batch a frame, repaints changed cells only
  });
  $effect(() => {
    stream.start();
    const socket = new WebSocket('wss://example.com/quotes');
    socket.onmessage = (e) => {
      const q: Partial<Quote> & { id: string } = JSON.parse(e.data);
      stream.push(q.id, q);
    };
    return () => {
      socket.close();
      stream.stop();
    };
  });
</script>

<Grid {rows} {columns} onReady={(a) => (api = a)} height={480} />
```

## Workflow

1. Read the docs page for the feature, and look up each prop in `api.json`.
2. Write the code.
3. Run the type check (`svelte-check`, or `tsc` outside Svelte) and fix every
   error before you finish.
4. If the app throws a `BG` error, apply its `Fix:`.
