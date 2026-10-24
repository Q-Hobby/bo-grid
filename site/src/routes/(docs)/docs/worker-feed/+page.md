---
title: Worker feeds
description: Read a busy socket in a Web Worker with serveFeed, and take one coalesced batch a frame on the main thread with connectFeed.
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Every socket message is a task on the thread that receives it. Up to a few thousand messages a second, receiving them on the main thread costs little, and a [tick stream](../tick-stream/) there is all a board needs. Past about 10,000 a second, receiving the messages takes real time from the frames: parsing them, and above all dispatching each one as a task. `serveFeed` and `connectFeed` move that work to a worker. The worker reads the socket, parses and coalesces the messages, and the main thread takes one batch a frame.

In the example, the worker generates and parses up to 20,000 JSON messages a second for 500 symbols. The page asks it for a batch each frame and hands it to `patchRows`. Raise the rate and the main thread does the same work: a batch a frame, never more than 400 patches.

<Example name="worker-feed" title="A feed read in a worker" />

## The two ends

In the worker, `serveFeed` is the end the socket pushes into. Patches for a key merge until the main thread takes them, as in `createTickStream`:

```ts
// feed.worker.ts
import { serveFeed } from 'bo-grid/realtime';

const feed = serveFeed<string, Partial<Quote>>();
const socket = new WebSocket(FEED_URL);
socket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  feed.push(m.symbol, { last: m.p, volume: m.v });
};
```

On the page, `connectFeed` asks the worker for a batch every frame and applies it:

```ts
import { connectFeed } from 'bo-grid/realtime';

const worker = new Worker(new URL('./feed.worker.ts', import.meta.url), { type: 'module' });
const feed = connectFeed<string, Partial<Quote>>(worker, {
  apply: (batch) => api.patchRows(batch), // at most `cap` (400) patches, never an empty batch
});
feed.start();
// feed.pending, feed.applied, feed.stop(), feed.close()
```

Each frame the page sends one request and the worker answers with what waits, so a batch is at most a frame old. A hidden tab stops asking; the worker keeps merging, and the first batch back is the latest state.

## Connecting

- The two ends talk over a `MessagePort` of their own, so the worker can carry other messages too.
- The page offers its port until `serveFeed` takes it, so the worker may set up its feed after an `await` (loading a symbol list first, say).
- Use a dedicated `Worker`, not a `SharedWorker`. When one worker serves several feeds, give each a `name`, the same on both ends. A name serves once per worker; a second `serveFeed` with it throws.
- `close()` stops the feed and closes its port; terminate the worker yourself when nothing else uses it.

## Patches and errors

Patches cross by structured clone, so keep them plain data: numbers, strings, plain objects and arrays. A patch that cannot be cloned is dropped and reported to `onError` on both ends, and the rest of the batch still arrives.

On the page, `onError` also hears when:

- `apply` throws (that batch is lost, the frames go on);
- no `serveFeed` answers within 5 s (a wrong name, or a worker that failed to load);
- a connected worker leaves a request unanswered for 1 s. `feed.stalled` turns true, and the page asks again.

`stop()` keeps what waits in the worker for the next `start()`; a batch already on its way is still applied.

## When it pays

`pnpm bench:feed` runs the same feed (1,600 symbols, JSON messages) into the same rows both ways in headless Chrome. In one run on a laptop, measured as the share of the main thread kept busy:

| Feed | Read on the main thread | Read in a worker |
| ---: | ---: | ---: |
| 10,000 messages/s | 11.2% | 3.3% |
| 30,000 messages/s | 24.5% | 5.6% |
| 100,000 messages/s | 62.8% | 5.1% |

Runs vary with the machine's load (14–25% at 30,000 a second and 40–70% at 100,000 on the main thread in other runs), but the worker's share stays at 3–6%, and the latency from message to patch is the same either way (10–16 ms at the median). Parsing and merging are under a third of the main thread's cost; the rest is dispatching each message as a task. Method and full table: [BENCHMARKS.md](https://github.com/bonguynvan/bo-grid/blob/main/BENCHMARKS.md#feed-ingestion-main-thread-vs-worker).

At a few thousand messages a second, `createTickStream` on the main thread is just as good, and simpler.

## Reference

`serveFeed<K, P>(options?)`, in the worker, returns a `FeedSource<K, P>`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `name` | `string` | `'feed'` | The feed's name, when a worker serves more than one. |
| `merge` | `(prev: P, next: P) => P` | field-wise for plain objects | Combines two patches for one key. |
| `onError` | `(err: unknown) => void` | none | Hears patches that could not be sent. |
| `scope` | `FeedScope` | the worker's global scope | Where the connection arrives. |

`FeedSource`: `push(key, patch)`, `pending` (keys waiting), `connected` (whether a page has connected).

`connectFeed<K, P>(worker, options)`, on the page, returns a `WorkerFeed`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `apply` | `(batch: Array<[K, P]>) => void` | required | Applies a frame's batch. |
| `cap` | `number` | `400` | Most patches in one batch. |
| `name` | `string` | `'feed'` | The worker's feed, as named in `serveFeed`. |
| `schedule` | `(fn) => cancel` | `requestAnimationFrame` | The frame scheduler. |
| `onError` | `(err: unknown) => void` | re-thrown asynchronously | Hears failed batches, dropped patches, no server, stalls. |

`WorkerFeed`: `start()`, `stop()`, `close()`, and `connected`, `stalled`, `pending` (keys waiting in the worker, as of the last batch), `applied`, `running`.
