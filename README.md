<div align="center">

<img src="public/favicon.svg" width="72" height="72" alt="bo-grid logo" />

# bo-grid

**The data grid for busy markets.**

A fast, lightweight Svelte 5 data grid for trading screens, with React and Vue
components and a custom element for every other framework.

[![npm](https://img.shields.io/npm/v/bo-grid?color=f2a93b&label=npm)](https://www.npmjs.com/package/bo-grid)
[![CI](https://github.com/bonguynvan/bo-grid/actions/workflows/ci.yml/badge.svg)](https://github.com/bonguynvan/bo-grid/actions/workflows/ci.yml)
[![core size](https://img.shields.io/badge/core-~46%20KB%20gzip-34d399)](./BENCHMARKS.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

### [Live demo and docs →](https://bonguynvan.github.io/bo-grid/)

<a href="https://bonguynvan.github.io/bo-grid/"><img src="docs/media/hero.gif" width="900" alt="A live price board: prices and volumes tint green or red as they tick, and the match price shows how far it moved" /></a>

</div>

## Install

```sh
npm i bo-grid
```

## Quick start

```svelte
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text',    key: 'symbol', header: 'Symbol' },
    { type: 'price',   key: 'price',  header: 'Price', flash: 'auto' },
    { type: 'percent', key: 'change', header: 'Chg %' },
  ];

  let rows = $state([{ id: 1, symbol: 'AAPL', price: 189.3, change: 1.24 }]);
</script>

<Grid {rows} {columns} height={480} />
```

Using React, Vue, Angular or plain JavaScript? See
[React, Vue & more](https://bonguynvan.github.io/bo-grid/docs/frameworks/).

## Learn more

- **[Docs](https://bonguynvan.github.io/bo-grid/docs/):** a page per feature, with live examples.
- **[Examples](https://bonguynvan.github.io/bo-grid/examples/):** every example running, with its source.
- **[Props reference](https://bonguynvan.github.io/bo-grid/docs/reference/):** every prop, column option and API method.
- **[For AI agents](https://bonguynvan.github.io/bo-grid/docs/ai/):** the docs also ship in the package, in `node_modules/bo-grid/dist/docs/`, and `npx bo-grid init` points your agent at them.
- **[TradeCanvas](https://github.com/bonguynvan/tradecanvas):** canvas trading charts that pair with bo-grid.
- [Benchmarks](./BENCHMARKS.md) · [Changelog](./CHANGELOG.md) · [Contributing](./CONTRIBUTING.md)

## License

[MIT](./LICENSE). If bo-grid saves you time, you can
[sponsor its development](https://github.com/sponsors/bonguynvan).
