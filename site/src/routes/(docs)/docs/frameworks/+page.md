---
title: React, Vue & more
description: The grid as a React or a Vue component, the <bo-grid> custom element for Angular and plain JavaScript, and server rendering.
---

bo-grid is a Svelte 5 component. In Svelte, import `Grid` from `bo-grid`: it is the smallest build, and the only one that takes Svelte snippets for custom cells. For React and Vue there are typed components, and for everything else a custom element.

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

- It loads the `<bo-grid>` element on the client, so server rendering (Next.js, Remix) renders its wrapper div and nothing else, and hydration matches; the bundle carries `'use client'` for server components.
- `className` and `style` go on that wrapper div, which keeps the grid's `height` until the element loads.
- Each render sets the element's config from the props. A new `rows` array is a new view: for a live feed, patch through the ref (`patchRows`, `flashCells`).
- React 18 and 19.

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
- The grid sees a new `rows` array, not changes inside one (a `push`, or a field set on a row): replace the array, or patch through the API.
- Vue 3.3 and up.

## Angular and plain JavaScript

`bo-grid/element` registers `<bo-grid>` and takes the whole grid API through one `config` property. Arrays and functions cannot be HTML attributes, so set it from code.

```ts
import { createBoGrid } from 'bo-grid/element';

const grid = createBoGrid({ columns, rows, height: 520, onCellEdit: save });
document.querySelector('#board').append(grid);
grid.config = { ...grid.config, rows: nextRows }; // updates re-render
```

In Angular, add `CUSTOM_ELEMENTS_SCHEMA` to the component and bind the property:

```ts
import 'bo-grid/element';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// @Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA], template: '<bo-grid [config]="config"></bo-grid>' })
```

- The element renders to the light DOM, so your `--bo-grid-*` CSS variables and page styles apply, and it injects its own styles: there is no stylesheet to add.
- It carries the Svelte runtime, so it is larger: about 87 KB gzip, against about 49 KB for the grid imported in Svelte.
- It needs the DOM: in a server-rendered app, import it on the client.

## Custom cells outside Svelte

Svelte snippets cannot be passed from JavaScript. For rich cells, give a column a `render({ row, column, value })` function that returns an `HTMLElement` or an HTML string; built-in types and `format` cover most cases.
