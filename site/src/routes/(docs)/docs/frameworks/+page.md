---
title: React, Vue & more
description: The grid as a React or a Vue component, the <bo-grid> custom element for Angular and plain JavaScript, and server rendering in each.
---

bo-grid is a Svelte 5 component. In Svelte, import `Grid` from `bo-grid`: it is the smallest build, and the only one that takes Svelte snippets for custom cells. For React and Vue there are typed components, and for everything else a custom element. All three take the same props and expose the same [grid API](../grid-api/).

| You write | Import | API handle |
| --- | --- | --- |
| Svelte 5 | `import { Grid } from 'bo-grid'` | `onReady` |
| React 18 or 19 | `import { BoGrid } from 'bo-grid/react'` | the component's `ref` |
| Vue 3.3+ | `import { BoGrid } from 'bo-grid/vue'` | the template ref's `api` |
| Angular, plain JS | `import 'bo-grid/element'` | `onReady` in the element's `config` |

Build-free starters for [plain JavaScript](https://github.com/bonguynvan/bo-grid/blob/main/examples/vanilla.html), [React](https://github.com/bonguynvan/bo-grid/blob/main/examples/react.html) and [Vue](https://github.com/bonguynvan/bo-grid/blob/main/examples/vue.html) are in the repository's `examples` folder: run `npx serve examples` and open one.

## React

`bo-grid/react` takes every `<Grid>` prop as a React prop; its `ref` is the grid's API.

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

- It loads the `<bo-grid>` element on the client, so server rendering (Next.js, Remix) renders its wrapper div and nothing else, and hydration matches. The bundle carries `'use client'` for server components.
- `className` and `style` go on that wrapper div, which keeps the grid's `height` until the element loads, so nothing jumps.
- Each render sets the element's config from the props. Unchanged arrays and functions are not reprocessed, but a new `rows` array is a new view: for a live feed, patch through the ref (`patchRows`, `flashCells`) instead of passing new rows.

## Vue

`bo-grid/vue` takes every `<Grid>` prop as an attribute (`:rows`, `:row-height`, a bare `footer`) and every callback as an event (`@cell-edit` is `onCellEdit`); the template ref's `api` is the grid's API.

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { BoGrid } from 'bo-grid/vue';

const grid = ref<InstanceType<typeof BoGrid>>();
// A live feed: patch the rows in place, with no re-render.
onMounted(() => feed.subscribe((ticks) => grid.value?.api?.patchRows(ticks)));
</script>

<template>
  <BoGrid ref="grid" :rows="rows" :columns="columns" :height="520" :row-height="32" @cell-edit="save" class="board" />
</template>
```

- Server rendering (Nuxt) renders the wrapper div only, and hydration matches; no `isCustomElement` setting is needed.
- A bare boolean attribute is true (`<BoGrid footer row-selection />`), and an event bound more than once calls every listener.
- The grid sees a new `rows` array, not changes inside one (a `push`, or a field set on a row). Keep the rows in a `shallowRef` and assign a new array, or patch through the API.
- `class` and `style` go on the wrapper div, which keeps the grid's `height` until the element loads.

## Angular and plain JavaScript

`bo-grid/element` registers `<bo-grid>` and takes the whole grid API through one `config` property. Arrays and functions cannot be HTML attributes, so set it from code; assigning a new `config` re-renders.

```ts
import { createBoGrid } from 'bo-grid/element';

const config = { columns, rows, height: 520, onCellEdit: save };
const grid = createBoGrid(config);
document.querySelector('#board')?.append(grid);
grid.config = { ...config, rows: nextRows }; // a new config re-renders
```

In Angular, add `CUSTOM_ELEMENTS_SCHEMA` to the component and bind the property:

```ts nocheck
import 'bo-grid/element';
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-board',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: '<bo-grid [config]="config"></bo-grid>',
})
export class BoardComponent {
  config = { columns, rows, height: 520 };
}
```

- The entry ships TypeScript types: `BoGridConfig` (every `<Grid>` prop), `BoGridElement` (an `HTMLElement` with a typed `config`) and `createBoGrid(config)`, which sets the config before the element is attached.
- Setting `config` after the element is attached is safe too: it renders an empty grid until the config arrives.
- The grid's API arrives through `onReady` in the config, once the grid is ready.
- The element renders to the light DOM, so your `--bo-grid-*` CSS variables and page styles apply, and it injects its own styles: there is no stylesheet to add.
- It carries the Svelte runtime, so it is larger: about 87 KB gzip, against about 46 KB for the grid imported in Svelte.
- It needs the DOM: in a server-rendered app, import it on the client.

## Custom cells outside Svelte

Svelte snippets cannot be passed from JavaScript, so the `cell` and `detail` snippets are Svelte-only. For rich cells, give a column a `render({ value, row, column })` function that returns a DOM node or an HTML string; built-in [column types](../column-types/) and `format` cover most cases without one.

```js
/** @type {import('bo-grid').ColumnDef[]} */
const columns = [
  {
    type: 'custom',
    key: 'status',
    header: 'Status',
    render: ({ value }) => {
      const dot = document.createElement('span');
      dot.textContent = value === 'up' ? '● Live' : '○ Idle';
      dot.style.color = value === 'up' ? 'var(--bo-up)' : 'var(--bo-text-dim)';
      return dot;
    },
  },
];
```

Sorting, filtering, tooltips, copy and export still use the value and `format`; `render` only changes how the cell looks. See [Custom cells](../custom-cells/#a-render-function).

## Live feeds and trading helpers

`bo-grid/realtime` and `bo-grid/trading` are plain JavaScript with no framework in them, so they import the same way everywhere. A tick stream coalesces messages per key and hands the grid one batch a frame:

```js
import { createBoGrid } from 'bo-grid/element';
import { createTickStream } from 'bo-grid/realtime';

/** @type {import('bo-grid').GridApi | undefined} */
let api;
const grid = createBoGrid({ columns, rows, height: 520, getRowId: (r) => String(r.symbol), onReady: (a) => (api = a) });
document.querySelector('#board')?.append(grid);

const stream = createTickStream({ apply: (batch) => api?.patchRows(batch) });
stream.start();
socket.onmessage = (e) => {
  const q = JSON.parse(e.data);
  stream.push(q.symbol, q); // cheap: coalesces per symbol, no render
};
```

In React the API is the component's `ref` (`grid.current`), and in Vue the template ref's `api`. The feed's key must match the rows' identity: set `getRowId`, as here, when the feed keys rows by something other than `id`. See [Tick streams](../tick-stream/) and [Market conventions](../trading/).

## Reference

Every prop on this page is a `<Grid>` prop: see the [Props reference](../reference/).
