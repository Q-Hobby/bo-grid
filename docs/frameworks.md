# Using bo-grid in React, Vue, Angular & vanilla

bo-grid is a Svelte 5 component, but it also ships a framework-agnostic **custom
element** (`<bo-grid>`) so you can use it anywhere.

```js
import 'bo-grid/element'; // registers <bo-grid> (styles inject automatically)
```

> **React or Vue?** Use the components, `bo-grid/react` and `bo-grid/vue`
> (below): typed props, the grid's API on a ref, and server rendering safe.
> The element itself serves Angular and plain JS.
>
> **Runnable starters:** [`examples/`](../examples/) has build-free HTML files for
> [vanilla](../examples/vanilla.html), [React](../examples/react.html) and
> [Vue](../examples/vue.html) — `npx serve examples` and open one.

The element takes the **whole grid API through a single `config` property** — set
it in JS (arrays and functions can't be HTML attributes). Updating `config`
re-renders reactively.

```js
const el = document.querySelector('bo-grid');
el.config = {
  height: 520,
  theme: 'dark',
  columns: [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'changePct', header: 'Chg %' },
  ],
  rows: data,
  rowSelection: true,
  filterMenu: true,
  onCellEdit: (e) => console.log(e),
};
```

> **Limitation:** the `cell` / `detail` **snippets** (fully custom cell rendering)
> can't be passed from plain JS — they're a Svelte compile-time feature. Use the
> built-in column types, a `format` function, or a computed `value` instead, which
> cover the vast majority of cases. Everything else — sorting, filtering, grouping,
> selection, inline editing, conditional formatting, computed columns, rich types,
> column virtualization, trees, lazy/server data, theming — works.

The `bo-grid/element` entry ships TypeScript types: a `BoGridConfig` (every
`<Grid>` prop), a `BoGridElement` interface (`HTMLElement` with a typed `config`),
and a `createBoGrid(config)` helper for the safe create-before-attach pattern.

## React

`bo-grid/react` is a typed component: every `<Grid>` prop is a React prop, and
its `ref` is the grid's API.

```tsx
import { useEffect, useRef } from 'react';
import { BoGrid } from 'bo-grid/react';
import type { GridApi } from 'bo-grid';

export function Board({ rows }: { rows: Quote[] }) {
  const grid = useRef<GridApi>(null);
  // A live feed: patch the rows in place, with no React re-render.
  useEffect(() => feed.subscribe((ticks) => grid.current?.patchRows(ticks)), []);
  return <BoGrid ref={grid} rows={rows} columns={columns} height={520} onCellEdit={save} className="board" />;
}
```

- It loads the `<bo-grid>` element on the client, so server rendering (Next.js,
  Remix) renders its wrapper div and nothing else, and hydration matches it;
  the bundle carries `'use client'` for server components.
- `className` and `style` go on that wrapper div; until the element has
  loaded, the div keeps the grid's `height` so nothing jumps.
- Each render sets the element's config from the props. Unchanged arrays and
  functions are not reprocessed, but a new `rows` array is a new view: for a
  live feed, patch through the ref (`patchRows`, `flashCells`) instead.
- React 18 and 19.

Writing the element by hand instead (it is what the component does):

```tsx
import { useEffect, useRef } from 'react';
import 'bo-grid/element';
import type { BoGridConfig, BoGridElement } from 'bo-grid/element';

export function MyGrid(config: BoGridConfig) {
  const ref = useRef<BoGridElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.config = config;
  }, [config]);
  return <bo-grid ref={ref} style={{ display: 'block' }} />;
}
```

Declare the tag once so JSX accepts `<bo-grid>`:

```tsx
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'bo-grid': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<import('bo-grid/element').BoGridElement>;
      };
    }
  }
}
```

Or skip JSX entirely with the helper:

```ts
import { createBoGrid } from 'bo-grid/element';
const el = createBoGrid({ columns, rows, height: 520 });
container.append(el);
```

## Vue 3

`bo-grid/vue` is a typed component: every `<Grid>` prop is an attribute
(`:rows`, `:row-height`), every callback an event (`@cell-edit` is
`onCellEdit`), and the template ref's `api` is the grid's API.

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BoGrid } from 'bo-grid/vue';

const grid = ref<InstanceType<typeof BoGrid>>();
// A live feed: patch the rows in place, with no re-render.
onMounted(() => feed.subscribe((ticks) => grid.value?.api?.patchRows(ticks)));
</script>

<template>
  <BoGrid ref="grid" :rows="rows" :columns="columns" :height="520" :row-height="32" @cell-edit="save" class="board" />
</template>
```

- It loads the `<bo-grid>` element on the client, so server rendering (Nuxt)
  renders its wrapper div and nothing else, and hydration matches it; no
  `isCustomElement` setting is needed.
- A bare boolean attribute is true (`<BoGrid footer row-selection />`), and an
  event bound more than once calls every listener.
- **Rows:** the grid sees a new `rows` array, not changes inside one (a
  `push`, or a field set on a row). Replace the array (keep it in a
  `shallowRef` and assign a new one), or, for a live feed, patch through the
  API: `grid.value?.api?.patchRows(ticks)`.
- `class` and `style` go on that wrapper div; until the element has loaded,
  the div keeps the grid's `height`.
- Vue 3.3 and up.

Writing the element by hand instead: tell Vue `bo-grid` is a custom element
(in `vite.config`:
`vue({ template: { compilerOptions: { isCustomElement: (t) => t === 'bo-grid' } } })`),
then bind `config` as a property:

```vue
<script setup lang="ts">
import 'bo-grid/element';
import type { BoGridConfig } from 'bo-grid/element';
const config: BoGridConfig = { columns, rows, theme: 'dark', filterMenu: true };
</script>

<template>
  <bo-grid :config.prop="config" />
</template>
```

## Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the module/component, then bind the property:

```ts
import 'bo-grid/element';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// @Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA], template: `<bo-grid [config]="config"></bo-grid>` })
```

```html
<bo-grid [config]="config"></bo-grid>
```

## Vanilla HTML/JS

```html
<script type="module">
  import { createBoGrid } from 'bo-grid/element';
  document.body.append(createBoGrid({ columns, rows, height: 520 }));
</script>
```

## Custom cells from JS

Svelte `cell`/`detail` snippets can't be passed from plain JS, so give a column a
**`render(ctx)`** function — return a DOM `Node` (appended as-is) or an HTML
string (set as innerHTML; sanitize untrusted data yourself). `ctx` is
`{ value, row, column }`:

```js
const columns = [
  { type: 'text', key: 'name', header: 'Name' },
  { type: 'custom', key: 'status', header: 'Status', render: ({ value }) => {
      const dot = document.createElement('span');
      dot.textContent = value === 'up' ? '● Live' : '○ Idle';
      dot.style.color = value === 'up' ? 'var(--bo-grid-up)' : 'var(--bo-grid-text-dim)';
      return dot;
    } },
];
```

Sort, filter, tooltip, copy and export still use the value / `format` — `render`
only controls how the cell looks.

## Realtime feeds

`bo-grid/realtime` is plain framework-agnostic JS — import it from React, Vue,
Angular or vanilla exactly the same way. Pair it with `flash: 'auto'` columns and
the grid flashes each changed cell green-up / red-down on its own:

```js
import { createTickStream, createRowIndex, applyPatches } from 'bo-grid/realtime';

const rows = [/* … */];
const index = createRowIndex(rows, (r) => r.symbol);

const stream = createTickStream({
  cap: 400, // max row writes per animation frame
  apply: (batch) => {
    applyPatches(index, batch);
    grid.config = { ...grid.config, rows: [...rows] }; // hand the new rows to <bo-grid>
  },
});
stream.start();

socket.onmessage = (e) => {
  const q = JSON.parse(e.data);
  stream.push(q.symbol, q); // cheap: coalesces per symbol, no render
};

const columns = [
  { type: 'text',  key: 'symbol', header: 'Symbol' },
  { type: 'price', key: 'last',   header: 'Last', flash: 'auto' },
];
```

Index rows by whatever your feed keys on (`symbol` here); the grid identifies
rows separately via `id`, or via a `getRowId` you put in `config` — that's the
key derived flash tracks cells by, so it must be stable across updates.

The `apply` callback runs at most once per frame with at most `cap` entries, so a
burst can't blow the frame budget — reassigning `config` there costs one update
per frame rather than one per message. Watch `stream.pending`: if it climbs and
stays up, the feed is outrunning the screen.

## Market conventions

`bo-grid/trading` (price-limit tone, tick-aware formatting, session state) is
likewise plain JS with no Grid/Cell coupling — use it from any framework via a
column's `render(ctx)` hook:

```js
import { resolveTone, toneColor, fmtTradingPrice, vnTickSize } from 'bo-grid/trading';

const columns = [
  { type: 'custom', key: 'price', header: 'Price', render: ({ value, row }) => {
      const tone = resolveTone(value, row.bands); // { ref, ceiling, floor } you computed per row
      const span = document.createElement('span');
      span.textContent = fmtTradingPrice(value, vnTickSize(value, row.exchange));
      span.style.color = toneColor(tone);
      return span;
    } },
];
```

See the "Market conventions" section in the [guide](./guide.md#market-conventions--bo-gridtrading) for the full
API and the **VN board** demo for a worked example.

## Notes

- `config` is safe to set **after** the element attaches (the React `ref` +
  `useEffect` pattern above): the grid defaults to empty `rows`/`columns` and
  renders a blank grid until `config` arrives, then reacts — no crash.
- The element renders to **light DOM** (`shadow: 'none'`), so your `--bo-grid-*`
  CSS variables and page styles apply normally, and the bundle injects its own
  styles on import — no separate stylesheet to include.
- The bundle is self-contained (it includes the Svelte runtime), so it's larger
  than the native Svelte import (~60 KB gzip). If you're already in Svelte, import
  the component directly (`import { Grid } from 'bo-grid'`) instead — it's far
  smaller and supports the `cell`/`detail` snippets.
- Client-only (custom elements need the DOM); guard SSR with a dynamic import in
  `onMount`/`useEffect`.
