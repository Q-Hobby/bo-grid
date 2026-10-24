---
title: Tick streams
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

A market feed pushes far more messages than a screen can show. Writing each one
straight into reactive state means thousands of updates to paint 60 frames, and
the tab stalls. `bo-grid/realtime` is the pipeline that fixes that — coalesce raw
messages per key (cheap, no reactive writes), then drain a bounded slice once per
animation frame:

```ts
import { createTickStream, createRowIndex, applyPatches } from 'bo-grid/realtime';

const index = createRowIndex(rows, (r) => r.symbol);
const stream = createTickStream<string, Partial<Quote>>({
  apply: (batch) => applyPatches(index, batch), // once per frame, ≤ cap entries
  cap: 400,                                     // max row writes per frame
});
stream.start();

socket.onmessage = (e) => {
  const q = JSON.parse(e.data);
  stream.push(q.symbol, q); // cheap: coalesces, no render
};
```

Per key only the **latest** state is applied — intermediate ticks collapse, which
is what a price board wants (append a trade tape directly instead). `cap` bounds
the work per frame, so a burst can't blow the frame budget: a sustained overload
shows up as a climbing `stream.pending` rather than dropped frames, and
`stream.applied` gives you a throughput counter — it only counts batches that
applied successfully. If `apply` throws, that frame's batch is lost (it's
already off the buffer by the time `apply` runs, so it can't be safely
re-queued) but the frame loop keeps going; pass `onError` to handle it yourself,
otherwise it's re-thrown asynchronously so it doesn't vanish silently.
`applyPatches` skips fields whose value didn't change, so an idle-but-chatty
feed neither re-renders nor flashes.

Row identity for flash comes from the grid's `getRowId` (default `row.id`), not
from the key you index the feed by — keep it stable across updates.

It's a **separate entry** with its own bundle — importing it adds nothing to
the grid core, and it's framework-agnostic (the frame scheduler is injectable,
which is also how it's unit-tested without a browser).

Only on-screen rows render DOM, so off-screen updates cost nothing until they
scroll into view.

## Live example

<Example id="liveblotter" />
