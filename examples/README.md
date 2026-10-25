# Framework examples

Runnable, build-free starters for the `<bo-grid>` custom element
(`bo-grid/element`). Each is a single HTML file that loads dependencies from a
CDN — open it through any static server:

```sh
npx serve examples        # then open vanilla.html / react.html / vue.html
```

| File | Stack |
|------|-------|
| [`vanilla.html`](./vanilla.html) | Plain HTML + ES modules |
| [`react.html`](./react.html) | React 18 (JSX-free via `htm`) |
| [`vue.html`](./vue.html) | Vue 3 |

Angular: see [React, Vue & more](https://bonguynvan.github.io/bo-grid/docs/frameworks/#angular-and-plain-javascript)
(`CUSTOM_ELEMENTS_SCHEMA` + `[config]` binding).

## The pattern

`<bo-grid>` takes the whole grid API through a single **`config` property** (set it
in JS — arrays and functions can't be HTML attributes). Updating `config`
re-renders reactively:

```js
import 'bo-grid/element';
const el = document.querySelector('bo-grid');
el.config = { columns, rows, theme: 'dark', height: 480 };
```

> Custom `cell`/`detail` snippets are Svelte-only and can't cross the JS boundary —
> use built-in column types, a `format` function, or a computed `value`. Native
> Svelte projects should `import { Grid } from 'bo-grid'` directly (smaller, and
> snippets work).

## Local dev (against this repo)

The examples import `bo-grid/element` from a CDN (the published package). To run
them against your local build instead, run `pnpm package` and change the import to
the built file:

```js
import '../dist/bo-grid.element.js';
```
