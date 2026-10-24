---
title: Tick streams
description: Coalesce a feed's messages per key and apply one bounded batch a frame with createTickStream, so a burst never costs more than the screen can show.
---

<script>
  import Example from '$lib/Example.svelte';
</script>

A market feed sends far more messages than a screen can show. Writing each one straight into rows means thousands of updates to paint 60 frames a second, and the tab stalls. `createTickStream` from `bo-grid/realtime` sits between the socket and the grid. Pushing a message into it is cheap: no reactive write, no render. Once a frame it hands the grid the latest patch for each key that changed, at most `cap` of them.

Pick a feed rate below and compare the messages that come in with the patches the grid applies. At 5,000 messages a second over 12 rows, almost every message is merged into a patch still waiting for its frame.

<Example name="tick-stream" title="Coalescing a feed" />

## Creating a stream

With plain rows, apply each batch through the grid's `patchRows` ([Live updates](../realtime/) explains why it is the fast path):

```ts
import { createTickStream } from 'bo-grid/realtime';

const stream = createTickStream<string, Partial<Quote>>({
  apply: (batch) => api.patchRows(batch), // once a frame, at most `cap` patches
});
stream.start();

socket.onmessage = (e) => {
  const q = JSON.parse(e.data);
  stream.push(q.symbol, q); // merges into the symbol's waiting patch
};
```

With `$state` rows, index them once and write the batch with `applyPatches`, which skips fields whose value did not change, so a chatty feed that re-sends the same price neither re-renders nor flashes:

```ts
import { applyPatches, createRowIndex, createTickStream } from 'bo-grid/realtime';

const index = createRowIndex(rows, (r) => r.symbol); // rebuild when symbols are added or removed
const stream = createTickStream<string, Partial<Quote>>({
  apply: (batch) => applyPatches(index, batch),
});
```

The key you push under is the feed's key. The grid's flash and selection follow its own row id (`getRowId`, `row.id` by default): keep that stable across updates.

## Coalescing

For each key, only the latest state is applied. Two patches that arrive for the same key between frames merge field by field when both are plain objects, so partial messages compose: `{ bid }` then `{ ask }` becomes `{ bid, ask }`. Anything else is last-write-wins. For updates that accumulate, pass `merge`:

```ts
const stream = createTickStream<string, { volume: number }>({
  apply: (batch) => api.patchRows(batch),
  merge: (prev, next) => ({ volume: prev.volume + next.volume }), // sum, don't replace
});
```

Keys drain in the order they first arrived, so a hot symbol cannot starve a quiet one: a key pushed again keeps its place in the queue.

A price board wants the latest state. A trade tape is the opposite case, where every trade must show: append trades to a `TradeTape` instead (see [Depth ladder](../depth-ladder/#time-and-sales)).

## Feed health

- **`cap`** bounds the patches applied in one frame (400 by default). A burst cannot blow the frame budget. A sustained overload shows as a climbing `stream.pending` instead of dropped frames.
- **`pending`** counts the keys waiting for a frame: your feed-health number.
- **`applied`** counts the patches applied since the stream was created, a throughput counter. A batch whose `apply` threw is not counted.
- **`stop()`** pauses draining and keeps what waits, so a paused stream resumes with the latest state; `stop({ discard: true })` drops it. **`flushNow()`** applies everything at once, ignoring the cap: for a tab regaining focus, or a last paint before teardown.

If `apply` throws, that frame's batch is lost: it left the buffer before `apply` ran, and re-queuing it could apply it twice. The frame loop keeps going. Pass `onError` to handle the error; without it, it is re-thrown asynchronously so it does not vanish.

## Scheduling and tests

The stream drains on `requestAnimationFrame`, falling back to a 16 ms timer where there is none (server rendering, tests). Pass `schedule` to drive the frames yourself; that is also how the stream is unit-tested without a browser:

```ts
let frame: (() => void) | undefined;
const stream = createTickStream({ apply, schedule: (fn) => ((frame = fn), () => (frame = undefined)) });
stream.start();
stream.push('VNM', { price: 68.6 });
frame?.(); // one frame: apply ran with [['VNM', { price: 68.6 }]]
```

`bo-grid/realtime` is a separate entry with its own bundle, and none of it depends on the grid: importing it adds nothing to the grid core.

The live blotter below applies 200 fills a frame into 100,000 orders through a stream and `patchRows`:

<Example id="liveblotter" />

## Reference

`createTickStream<K, P>(options)` returns a `TickStream<K, P>`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `apply` | `(batch: Array<[K, P]>) => void` | required | Applies a frame's patches. Called at most once a frame, never with an empty batch. |
| `cap` | `number` | `400` | Most patches applied in one frame. |
| `merge` | `(prev: P, next: P) => P` | field-wise for plain objects | Combines two patches for one key between frames. |
| `schedule` | `(fn) => cancel` | `requestAnimationFrame` | The frame scheduler. |
| `onError` | `(err: unknown) => void` | re-thrown asynchronously | Hears an `apply` that threw. |

| Member | What it is |
| --- | --- |
| `push(key, patch)` | Takes one message's patch. |
| `start()` | Begins draining every frame. Idempotent. |
| `stop(opts?)` | Stops draining; `{ discard: true }` drops the waiting patches. |
| `flushNow()` | Applies everything waiting, ignoring the cap. |
| `pending` | Keys waiting for a frame. |
| `applied` | Patches applied since creation. |
| `running` | Whether it is draining. |

Helpers: `createRowIndex(rows, getRowId)` maps ids to rows; `applyPatches(index, batch)` writes a batch into indexed rows, skipping unchanged fields, and returns how many found a row. `TickBuffer` is the coalescing buffer on its own, for a loop you run yourself.
