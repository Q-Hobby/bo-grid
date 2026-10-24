---
title: Introduction
description: bo-grid is a fast, lightweight data grid for trading screens. It is native to Svelte 5, with components for React and Vue and a custom element for every other framework.
---

## Why bo-grid

- **Fast under load.** A 1,000-symbol price board at 30,000 ticks a second stays at about 12 ms of main-thread work per frame, with every changed cell flashing ([how it's measured](https://github.com/bonguynvan/bo-grid/blob/main/BENCHMARKS.md)).
- **Built for trading.** Tick flashes, price-limit colours, tick-aware formatting, a depth ladder with click-to-trade, order books, alerts, and a feed read in a worker.
- **Complete.** Sorting, filtering, grouping, pivot, tree data, editing, clipboard and Excel export, all in one MIT package.
- **Small and SSR-safe.** About 49 KB gzip for the grid, no runtime dependencies, and clean server rendering in SvelteKit.
- **Accessible.** A full keyboard model with grid and treegrid semantics.

## What is in the package

| Import | What it gives you |
| --- | --- |
| `bo-grid` | The `Grid` component, its column types and its API |
| `bo-grid/realtime` | Live feeds: a coalescing tick stream, a feed read in a worker, an order book, alerts, rows that linger, a trade tape |
| `bo-grid/trading` | Market conventions: price limits and tones, sessions, FX pips, crypto prices, basis points and 32nds, positions from fills |
| `bo-grid/ladder` | `DepthLadder`, a price ladder with click-to-trade |
| `bo-grid/react`, `bo-grid/vue` | The grid as a React or a Vue component |
| `bo-grid/element` | The `<bo-grid>` custom element, for Angular and plain JavaScript |

Each entry is separate: an app pays only for what it imports.

## Where to next

- [Installation](getting-started/): install the package and render a first grid in your framework.
- [React, Vue & more](frameworks/): the components, the custom element, and server rendering.
- [Examples](../examples/): every example runs live, with its source a tab away.

## With an AI coding assistant

bo-grid is a Svelte 5 library: in Svelte, write runes (`$state`, `$props`), snippets and callback props, never `export let`, `on:click` or `<slot>`. The full API in one file for assistants is at [llms-full.txt](https://bonguynvan.github.io/bo-grid/llms-full.txt), and ready-made rules for Claude Code and Cursor are in [docs/ai](https://github.com/bonguynvan/bo-grid/tree/main/docs/ai).
