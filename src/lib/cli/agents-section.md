## bo-grid (data grid)

This project uses `bo-grid`. Before writing grid code, read
node_modules/bo-grid/dist/docs/README.md and the page for the feature: the
docs of the installed version, one Markdown file per page (online:
https://bonguynvan.github.io/bo-grid/llms.txt). Every prop, column option and
API method, with types and defaults, is in
node_modules/bo-grid/dist/docs/api.json. Never invent a prop: if it is not in
api.json or the types in node_modules/bo-grid, it does not exist.

- Svelte 5 only: runes (`$state`, `$derived`, `$props`), snippets and
  callback props. Never `export let`, `on:click` or `<slot>`.
- Imports: `Grid` and types from `bo-grid`; feeds from `bo-grid/realtime`;
  market helpers from `bo-grid/trading`; `DepthLadder` from `bo-grid/ladder`;
  React `BoGrid` from `bo-grid/react`; Vue `BoGrid` from `bo-grid/vue`;
  the custom element from `bo-grid/element`.
- Minimal grid: `<Grid {rows} {columns} height={400} />`. Every row needs a
  unique `id` (a number or a string), or pass `getRowId`.
- Live prices: a column with `flash: 'auto'` flashes changes by itself. Write
  ticks with `api.patchRows(patches)` (the API comes from `onReady`), fed by
  `createTickStream`. Don't write `flashSeq` or `flashDir` bookkeeping.
- To add, remove or reorder rows, assign a new array; `patchRows` only
  changes fields of rows that exist.
- Outside Svelte there are no snippets: draw custom cells with a column's
  `render(ctx)` function.
- After editing, run the type check (`svelte-check` or `tsc`) and fix errors.
- A runtime error that starts with a `BG` code ends with `Fix:`; apply it as
  written.
