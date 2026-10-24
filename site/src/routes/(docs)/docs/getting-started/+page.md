---
title: Quick start
description: Install bo-grid and render a first grid in Svelte, React, Vue or plain JavaScript.
---

<script>
  import Example from '$lib/Example.svelte';
  import FrameworkTabs from '$lib/FrameworkTabs.svelte';
  import Props from '$lib/Props.svelte';
  import { firstGrid, liveFeed } from '$lib/snippets';
</script>

## Install

```sh
npm i bo-grid
```

Svelte 5 is a peer dependency. React and Vue are optional peers, needed only for `bo-grid/react` and `bo-grid/vue`.

## A first grid

Give the grid rows (each with an `id`) and columns. A column's `type` picks how its values show: `price`, `percent`, `volume`, `date`, `heatmap`, `sparkline` and more. The tabs follow the framework chosen in the top bar.

<FrameworkTabs code={firstGrid} />

The same grid, running: sort a column from its header, resize one from its edge, or select a range to see its sum.

<Example name="quick-start" title="A first grid" />

The three props every grid takes:

<Props names={['rows', 'columns', 'height']} />

## A live feed

For a busy feed, keep the rows as plain objects and let the grid write the ticks. `createTickStream` coalesces messages per key and hands the grid one batch a frame; `patchRows` repaints only the cells that changed.

<FrameworkTabs code={liveFeed} />

Past about 10,000 messages a second, read the socket in a worker with `serveFeed` and `connectFeed`: the main thread then takes one batch a frame instead of every message.

## Next

- [React, Vue & more](../frameworks/): props, the API on a ref, and server rendering.
- [Price board](../../examples/priceboard/): a full board under a busy feed, live.
- [Examples](../../examples/): every feature, live, with its source.
