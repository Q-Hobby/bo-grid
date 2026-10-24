---
title: Viewport streaming
description: TODO
---

A board of 1,600 symbols shows 30–80 at a time. `onViewportChange` reports the
data rows on screen (plus the small buffer rendered around them) whenever that
set changes — scroll, sort, filter, new data — and never for a value-only tick.
`createViewportSubscriptions` turns it into subscribe / unsubscribe calls: the
first view subscribes at once, later changes settle for `delay` ms (default
150, so a fast scroll is one change) and then subscribe what came into view and
unsubscribe what left:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createViewportSubscriptions } from 'bo-grid/realtime';

  const subs = createViewportSubscriptions({
    key: (row) => row.symbol,
    subscribe: (syms) => socket.send(JSON.stringify({ op: 'sub', syms })),
    unsubscribe: (syms) => socket.send(JSON.stringify({ op: 'unsub', syms })),
  });
  onDestroy(subs.clear);
</script>

<Grid {rows} {columns} onViewportChange={subs.update} />
```

While a scroll is in progress the previous symbols stay subscribed; `flush()`
applies a pending change at once. Each update costs about a microsecond.
