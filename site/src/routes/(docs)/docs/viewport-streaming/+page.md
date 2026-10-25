---
title: Viewport streaming
description: Subscribe a feed to just the rows on screen with onViewportChange and createViewportSubscriptions, so a board of thousands of symbols streams only the few dozen in view.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A board of 1,600 symbols shows 30 to 80 at a time. Streaming all of them costs the server, the network and the client for values nobody sees. The grid's `onViewportChange` reports the data rows on screen, and `createViewportSubscriptions` from `bo-grid/realtime` turns those reports into subscribe and unsubscribe calls for your feed.

The board below has 1,000 symbols, but its simulated server sends ticks only for the subscribed ones. Scroll it: once the view settles, the feed follows the rows on screen.

<Example name="viewport-streaming" title="Streaming the rows in view" />

## The rows on screen

`onViewportChange` is called with the data rows on screen, plus the small buffer rendered above and below them, whenever that set changes: a scroll, a sort, a filter, new data. A tick that only changes values never calls it. Group rows, loading rows and pinned rows are not included.

```svelte
<Grid {rows} {columns} height={600} onViewportChange={(view) => console.log(view.first, view.last, view.rows.length)} />
```

`first` and `last` are the visual indexes of the first and last row reported, or -1 when no data row is on screen; `rows` are the rows themselves, in view order.

## Subscribing what is in view

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Grid } from 'bo-grid';
  import { createViewportSubscriptions } from 'bo-grid/realtime';

  const subs = createViewportSubscriptions({
    key: (row: GridRow) => String(row.symbol),
    subscribe: (syms) => socket.send(JSON.stringify({ op: 'sub', syms })),
    unsubscribe: (syms) => socket.send(JSON.stringify({ op: 'unsub', syms })),
  });
  onDestroy(subs.clear);
</script>

<Grid {rows} {columns} onViewportChange={subs.update} height={600} />
```

- The first view subscribes at once.
- Later changes settle for `delay` ms (150 by default), so a fast scroll is one change rather than one a frame. Then it subscribes the keys that came into view and unsubscribes the ones that left. While a scroll is in progress, the previous keys stay subscribed.
- `flush()` applies a pending change at once; `clear()` unsubscribes everything and drops a pending change (on unmount, or when the socket closes); `active` is the set of keys subscribed now.
- `subscribe` and `unsubscribe` are always called with at least one key.

Pass every change to `update` without throttling it: the `delay` does the settling.

Combine it with a [tick stream](../tick-stream/) or a [worker feed](../worker-feed/) for the ticks that come back: the grid applies them the same way whether a row is on screen or not, and rows that scroll in show their latest values.

## Reference

<Props names={['onViewportChange']} />

`createViewportSubscriptions<R, K>(options)` returns a `ViewportSubscriptions<K>`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `key` | `(row: R) => K` | required | The feed key of a row (its symbol). |
| `subscribe` | `(keys: K[]) => void` | required | Starts streaming these keys. |
| `unsubscribe` | `(keys: K[]) => void` | required | Stops streaming these keys. |
| `delay` | `number` | `150` | How long the view must stay put before a change applies, in ms; `0` applies every change at once. |

| Member | What it is |
| --- | --- |
| `update(view)` | Takes a view change: pass it as the grid's `onViewportChange`. |
| `flush()` | Applies a pending change now. |
| `clear()` | Unsubscribes everything and drops a pending change. |
| `active` | The keys subscribed now. |
