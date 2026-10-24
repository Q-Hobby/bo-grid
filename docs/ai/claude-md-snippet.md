<!--
  Paste this section into your project's CLAUDE.md (or AGENTS.md) so Claude
  Code / any agent that reads it generates correct bo-grid code from the
  start. Works as-is; trim if you don't use a given subpath.
-->

## bo-grid (Svelte 5 data grid)

This project depends on `bo-grid` (peer `svelte@^5`). Before writing or
editing bo-grid code, read `https://bonguynvan.github.io/bo-grid/llms.txt`
(the facts to get right, and every docs page as Markdown), and look props up
in `https://bonguynvan.github.io/bo-grid/api.json` (every prop, column option
and API method, generated from the types) — do not guess a prop name or
invent a plausible-sounding one. The installed types in
`node_modules/bo-grid/dist` carry the same docs for your version.

**Seven entry points** — importing one adds nothing to the others, and each
export lives in exactly one place:
- `bo-grid` — the `Grid` component, its column types, core types and helpers.
- `bo-grid/realtime` — `createTickStream`, `serveFeed` / `connectFeed`, `createOrderBook`, `createAlerts`, `createLinger`, `TradeTape`.
- `bo-grid/trading` — market conventions: `resolveTone`, `vnBands`, `fmtTradingPrice`, `sessionStateAt`, FX pips, crypto prices, `createPositions`.
- `bo-grid/ladder` — `DepthLadder`, a price ladder with click-to-trade.
- `bo-grid/react`, `bo-grid/vue` — `BoGrid` as a React or Vue component.
- `bo-grid/element` — the `<bo-grid>` custom element (Angular, plain JS).

**Svelte 5 only:** runes (`$state`, `$props`), snippets and callback props;
never `export let`, `on:click` or `<slot>`. The grid API comes from
`onReady={(api) => ...}` (a ref in React and Vue); there is no `bind:api`.

**Minimal usage**:
```svelte
<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 120 },
    { type: 'price', key: 'price', header: 'Price', width: 90, flash: 'auto' },
  ];
  let rows: GridRow[] = $state([{ id: 1, symbol: 'AAPL', price: 227.5 }]); // GridRow needs only `id`
</script>
<Grid {rows} {columns} height={640} />
```

**Realtime cell flash — always `flash: 'auto'`, never hand-roll it:**
```ts
const price: ColumnDef = { type: 'price', key: 'price', header: 'Price', flash: 'auto' }; // the column
row.price = next; // the whole update
```
Do **not** generate `row.flashSeq++`/`row.flashDir = ...` bookkeeping for a
new column — that's the legacy `flash: true` pattern, only needed if the row-
driven mode is explicitly requested. `GridRow.flashSeq`/`flashDir` are
optional and unnecessary otherwise.

**Custom cells**: a Svelte `cell` snippet in Svelte code; a column's
`render(ctx) => Node | string` function from React/Vue/vanilla/`<bo-grid>`
(snippets don't exist outside Svelte).

**Busy feeds:** keep rows as plain objects and write ticks with
`api.patchRows(patches)`, fed by `createTickStream` from `bo-grid/realtime`.

**Runtime errors:** a bo-grid error starts with a stable code (`BG2004: ...`)
and ends with `Fix:` and a link to `/docs/errors/`. Apply the fix as written.

**Before generating non-trivial code** (new column types, a realtime feed, the
web component), read the matching docs page (`/docs/<topic>.md`, listed in
`llms.txt`) rather than extrapolating from this summary.
