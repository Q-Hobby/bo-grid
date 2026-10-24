// A feed read, decoded and coalesced in a worker, applied on the main thread
// one batch a frame.
//
// Every socket message is a task on the thread that receives it. At 30,000
// messages a second, reading a feed on the main thread took 14–25% of it in
// headless Chrome (under a third of that parsing; the rest the dispatch of
// each message), against 3–6% when a worker reads the socket and the main
// thread takes one batch a frame; at 100,000 a second, 40–70% against 3–6%,
// with the same latency (`pnpm bench:feed`, BENCHMARKS.md).
//
//   // feed.worker.ts (a dedicated Worker)
//   import { serveFeed } from 'bo-grid/realtime';
//   const feed = serveFeed<string, Partial<Quote>>();
//   const socket = new WebSocket(FEED_URL);
//   socket.onmessage = (e) => {
//     const m = JSON.parse(e.data);
//     feed.push(m.symbol, { last: m.p, volume: m.v });
//   };
//
//   // the page
//   import { connectFeed } from 'bo-grid/realtime';
//   const worker = new Worker(new URL('./feed.worker.ts', import.meta.url), { type: 'module' });
//   const feed = connectFeed<string, Partial<Quote>>(worker, { apply: (batch) => api.patchRows(batch) });
//   feed.start();
//
// The two ends talk over a MessagePort of their own, so the worker's other
// messages are left alone; the page offers the port until the worker's
// serveFeed takes it, so serveFeed may start after an await. Patches cross by
// structured clone: keep them plain data. One that cannot be cloned is
// dropped and reported, and the rest still arrive.
import { DEFAULT_CAP, TickBuffer, defaultOnError, defaultScheduler, type Cancel, type Scheduler, type TickBufferOptions } from './ticks';
import { boError } from '../errors';

/** The worker as the main thread sees it: a dedicated `Worker`. */
export interface FeedWorker {
  postMessage(message: unknown, transfer: Transferable[]): void;
}

/** The worker's global scope as `serveFeed` uses it. */
export type FeedScope = Pick<EventTarget, 'addEventListener'>;

export interface ServeFeedOptions<P> extends TickBufferOptions<P> {
  /** The feed's name, when a worker serves more than one; `connectFeed`
      names the same. Default `'feed'`. */
  name?: string;
  /** Where the connection arrives: the worker's global scope (the default). */
  scope?: FeedScope;
  /** Called in the worker when patches could not be sent (they could not be
      structured-cloned); the page's `onError` hears of it too. */
  onError?: (err: unknown) => void;
}

/** The worker's end: push messages in; the main thread drains them. */
export interface FeedSource<K, P> {
  /** Ingest one message's patch for `key`; patches for a key merge until the
      main thread takes them. */
  push(key: K, patch: P): void;
  /** Keys waiting for the main thread. */
  readonly pending: number;
  /** Whether a main thread has connected (`connectFeed`). */
  readonly connected: boolean;
}

export interface ConnectFeedOptions<K, P> {
  /** Apply a frame's batch: at most `cap` patches, never an empty batch. */
  apply: (batch: Array<[K, P]>) => void;
  /** Max patches a frame. Default 400. */
  cap?: number;
  /** The worker's feed, as named in `serveFeed`. Default `'feed'`. */
  name?: string;
  /** Frame scheduler. Default `requestAnimationFrame`. */
  schedule?: Scheduler;
  /** Called when `apply` throws (that batch is lost, the frames go on), when
      patches could not be sent from the worker, when no `serveFeed` answers
      within 5 s, and when a connected worker stops answering for 1 s.
      Default: re-thrown asynchronously, so it surfaces as an unhandled error. */
  onError?: (err: unknown) => void;
}

/** The main thread's end. */
export interface WorkerFeed {
  /** Ask for a batch every frame. Idempotent. */
  start(): void;
  /** Stop asking; what waits stays in the worker for the next start. A batch
      already on its way is still applied. */
  stop(): void;
  /** Stops and closes the connection. */
  close(): void;
  /** Whether the worker's `serveFeed` has taken the connection. */
  readonly connected: boolean;
  /** Whether the worker has gone 1 s without answering a request. */
  readonly stalled: boolean;
  /** Keys waiting in the worker, as of the last batch. */
  readonly pending: number;
  /** Patches applied since connecting. */
  readonly applied: number;
  readonly running: boolean;
}

const CONNECT = 'bo-grid:feed';
/** How often the page offers its port until the worker takes it, ms. */
const RETRY = 250;
/** How long without a serveFeed before the page reports it, ms. */
const NO_SERVER = 5000;
/** How long a connected worker may leave a request unanswered, ms. */
const STALL = 1000;

type Reply<K, P> = { ack?: number; batch?: Array<[K, P]>; pending?: number; dropped?: number; error?: string };

const served = new WeakMap<FeedScope, Set<string>>();

/** Sends a batch, leaving out what cannot be cloned rather than failing it
    all (and leaving the page waiting). */
function send<K, P>(port: MessagePort, batch: Array<[K, P]>, pending: number): { dropped: number; error?: unknown } {
  try {
    port.postMessage({ batch, pending });
    return { dropped: 0 };
  } catch (error) {
    const clones = (entry: [K, P]): boolean => {
      try {
        structuredClone(entry);
        return true;
      } catch {
        return false;
      }
    };
    const good = typeof structuredClone === 'function' ? batch.filter(clones) : [];
    const dropped = batch.length - good.length;
    const message = error instanceof Error ? error.message : String(error);
    try {
      port.postMessage({ batch: good, pending, dropped, error: message });
    } catch {
      port.postMessage({ batch: [], pending, dropped: batch.length, error: message });
    }
    return { dropped, error };
  }
}

/** In the worker: the feed's end that the socket pushes into. One per name
    per worker. */
export function serveFeed<K, P>(opts: ServeFeedOptions<P> = {}): FeedSource<K, P> {
  const name = opts.name ?? 'feed';
  const scope = opts.scope ?? (globalThis as unknown as FeedScope);
  const names = served.get(scope) ?? new Set<string>();
  if (names.has(name)) throw boError(Error, 'BG2001', `serveFeed("${name}") already runs in this worker.`, 'Give each feed in a worker its own name (serveFeed({ name })), or close the first one.');
  names.add(name);
  served.set(scope, names);
  const buffer = new TickBuffer<K, P>({ merge: opts.merge });
  let port: MessagePort | null = null;
  scope.addEventListener('message', (e) => {
    const m = e as MessageEvent;
    const data = m.data as { kind?: unknown; name?: unknown; id?: unknown } | null;
    if (data?.kind !== CONNECT || data.name !== name || !m.ports[0]) return;
    port?.close();
    const next = m.ports[0];
    next.onmessage = (req: MessageEvent<{ cap?: unknown }>) => {
      const cap = Number(req.data?.cap);
      const sent = send(next, buffer.drain(Number.isFinite(cap) && cap >= 1 ? Math.floor(cap) : DEFAULT_CAP), buffer.size);
      if (sent.error !== undefined) opts.onError?.(sent.error);
    };
    next.postMessage({ ack: data.id });
    port = next;
  });
  return {
    push: (key, patch) => buffer.push(key, patch),
    get pending() {
      return buffer.size;
    },
    get connected() {
      return port !== null;
    },
  };
}

/** On the main thread: takes the worker's coalesced patches one batch a
    frame and hands them to `apply`. One per `serveFeed`: a second connection
    replaces the first. */
export function connectFeed<K, P>(worker: FeedWorker, opts: ConnectFeedOptions<K, P>): WorkerFeed {
  const cap = opts.cap ?? DEFAULT_CAP;
  const name = opts.name ?? 'feed';
  const schedule = opts.schedule ?? defaultScheduler;
  const onError = opts.onError ?? defaultOnError;
  let port: MessagePort | null = null;
  let live = false;
  let offers = 0;
  let offered = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let running = false;
  let waiting = false;
  let askedAt = 0;
  let stalled = false;
  let cancel: Cancel | null = null;
  let pending = 0;
  let applied = 0;

  function receive(e: MessageEvent<Reply<K, P>>): void {
    const r = e.data;
    if (r.ack !== undefined) {
      if (r.ack === offers) {
        live = true;
        clearTimeout(retry);
      }
      return;
    }
    waiting = false;
    stalled = false;
    pending = r.pending ?? 0;
    if (r.error !== undefined) onError(new Error(`bo-grid feed: ${r.dropped} patches could not be sent from the worker (${r.error})`));
    const batch = r.batch ?? [];
    if (batch.length === 0) return;
    try {
      opts.apply(batch);
      applied += batch.length;
    } catch (err) {
      onError(err);
    }
  }

  // Offers a fresh port until the worker's serveFeed takes one; a worker may
  // start serving after an await, when an earlier offer found no listener.
  function offer(): void {
    if (closed || live) return;
    port?.close();
    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = receive;
    offers++;
    worker.postMessage({ kind: CONNECT, name, id: offers }, [channel.port2]);
    if (offers === 1) offered = Date.now();
    else if (offered && Date.now() - offered >= NO_SERVER) {
      offered = 0;
      onError(new Error(`bo-grid feed: no serveFeed("${name}") answered in the worker within ${NO_SERVER / 1000} s`));
    }
    retry = setTimeout(offer, RETRY);
  }

  function frame(): void {
    if (!running) return;
    cancel = schedule(frame);
    if (!live || !port) return;
    if (waiting) {
      if (Date.now() - askedAt < STALL) return;
      // One request in flight, but a worker that stopped answering is asked
      // again rather than waited on for ever.
      if (!stalled) {
        stalled = true;
        onError(new Error(`bo-grid feed: the worker has not answered for ${STALL / 1000} s`));
      }
    }
    waiting = true;
    askedAt = Date.now();
    port.postMessage({ cap });
  }

  const stop = (): void => {
    running = false;
    cancel?.();
    cancel = null;
  };

  offer();
  return {
    start() {
      if (running || closed) return;
      running = true;
      cancel = schedule(frame);
    },
    stop,
    close() {
      stop();
      closed = true;
      clearTimeout(retry);
      port?.close();
    },
    get connected() {
      return live;
    },
    get stalled() {
      return stalled;
    },
    get pending() {
      return pending;
    },
    get applied() {
      return applied;
    },
    get running() {
      return running;
    },
  };
}
