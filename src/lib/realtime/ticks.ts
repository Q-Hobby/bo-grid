// Realtime tick ingestion.
//
// The problem this solves: a market data feed pushes far more messages than the
// screen can show. Writing each message straight into reactive state means the
// framework does 10,000 updates to paint 60 frames, and the tab stalls. The fix
// is two-stage — coalesce raw messages into a per-key buffer (cheap, no reactive
// writes), then drain a bounded slice of that buffer once per animation frame.
//
// Consequences worth knowing:
//   - Per key, only the LATEST state is ever applied. Intermediate ticks are
//     collapsed, which is what you want for a price board and what you do NOT
//     want for a trade tape (append those directly, or key them uniquely).
//   - `cap` bounds the work per frame, so a burst cannot blow the frame budget.
//     A sustained overload shows up as a growing `pending` depth rather than as
//     dropped frames — surface it if your feed can outrun the screen.
//
// Nothing here is Svelte-specific or DOM-specific: the scheduler is injectable,
// which is also how it is unit-tested without a browser.

/** Cancels a scheduled callback. */
export type Cancel = () => void;

/** Schedules `fn` to run on the next frame. Returns a canceller. */
export type Scheduler = (fn: () => void) => Cancel;

/** Default patches applied per frame. ~400 keyed writes fit comfortably inside a
    60 fps budget on mid-range hardware while keeping a busy board current. */
export const DEFAULT_CAP = 400;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge two patches for the same key: field-wise for plain objects (so partial
    patches compose), last-write-wins for anything else. */
function defaultMerge<P>(prev: P, next: P): P {
  if (isPlainObject(prev) && isPlainObject(next)) return { ...prev, ...next } as P;
  return next;
}

export interface TickBufferOptions<P> {
  /** How to combine two patches that arrive for the same key between frames.
      Default: field-wise merge for plain objects, else last-write-wins. Use it
      for accumulating updates (e.g. summing traded volume). */
  merge?: (prev: P, next: P) => P;
}

/**
 * A coalescing buffer: many pushes per key collapse into one pending patch.
 *
 * Drains in insertion order so a hot key cannot starve a quiet one — re-pushing
 * an already-pending key updates it in place without moving it to the back.
 */
export class TickBuffer<K, P> {
  private readonly pending = new Map<K, P>();
  private readonly merge: (prev: P, next: P) => P;

  constructor(opts: TickBufferOptions<P> = {}) {
    this.merge = opts.merge ?? defaultMerge;
  }

  /** Pending key count — your feed-health number. */
  get size(): number {
    return this.pending.size;
  }

  push(key: K, patch: P): void {
    const prev = this.pending.get(key);
    // `has` would be a second lookup; undefined is not a meaningful patch.
    this.pending.set(key, prev === undefined ? patch : this.merge(prev, patch));
  }

  /** Remove and return at most `cap` pending entries, oldest first. */
  drain(cap: number): Array<[K, P]> {
    const out: Array<[K, P]> = [];
    if (cap <= 0) return out;
    for (const entry of this.pending) {
      out.push(entry);
      this.pending.delete(entry[0]);
      if (out.length >= cap) break;
    }
    return out;
  }

  clear(): void {
    this.pending.clear();
  }
}

export interface TickStreamOptions<K, P> extends TickBufferOptions<P> {
  /** Apply a frame's worth of coalesced patches. Called at most once per frame,
      with at most `cap` entries, and never with an empty batch. */
  apply: (batch: Array<[K, P]>) => void;
  /** Max patches applied per frame. Default 400. */
  cap?: number;
  /** Frame scheduler. Defaults to `requestAnimationFrame`, falling back to a
      ~16 ms timer where it is unavailable (SSR, tests, hidden tabs). */
  schedule?: Scheduler;
  /** Called when `apply` throws. The batch is already removed from the buffer
      by the time `apply` runs, so a throw loses that frame's patches — there is
      no way to know how far a partial `apply` got, and re-queuing risks
      double-applying. `applied` is not incremented for a failed batch, so it
      stays an accurate "successfully applied" count. The frame loop itself is
      unaffected either way (it re-arms before draining). Default: re-throws
      asynchronously (so it surfaces as an unhandled error) without unwinding
      the scheduler's call stack. */
  onError?: (err: unknown) => void;
}

export interface TickStream<K, P> {
  /** Ingest one raw message. Cheap — no reactive writes, no rendering. */
  push(key: K, patch: P): void;
  /** Begin draining on every frame. Idempotent. */
  start(): void;
  /** Stop draining. Pending ticks are kept unless `discard` is set, so a paused
      stream resumes with the latest state rather than a stale screen. */
  stop(opts?: { discard?: boolean }): void;
  /** Drain everything right now, ignoring the cap. For a tab regaining focus, a
      test, or a final paint before teardown. */
  flushNow(): void;
  /** Patches waiting for a frame. A number that keeps climbing means the feed is
      outrunning the screen. */
  readonly pending: number;
  /** Total patches successfully applied since creation (a batch whose `apply`
      threw is not counted — see `onError`). */
  readonly applied: number;
  readonly running: boolean;
}

export const defaultScheduler: Scheduler = (fn) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(() => fn());
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(fn, 16);
  return () => clearTimeout(id);
};

// Surfaces an `apply` failure without letting it unwind the scheduler's call
// stack (which could otherwise cancel the frame loop depending on the
// scheduler). Deferred to a microtask so it reports as an unhandled error
// (visible in the console / error-reporting tools) rather than being silently
// swallowed by a caller that doesn't check for one.
export function defaultOnError(err: unknown): void {
  const rethrow = (): void => {
    throw err;
  };
  if (typeof queueMicrotask === 'function') queueMicrotask(rethrow);
  else setTimeout(rethrow, 0);
}

/**
 * Frame-budgeted realtime updates.
 *
 * ```ts
 * const stream = createTickStream<string, Partial<Quote>>({
 *   apply: (batch) => applyPatches(index, batch),
 * });
 * stream.start();
 * socket.onmessage = (e) => { const q = JSON.parse(e.data); stream.push(q.symbol, q); };
 * ```
 */
export function createTickStream<K, P>(opts: TickStreamOptions<K, P>): TickStream<K, P> {
  const buffer = new TickBuffer<K, P>({ merge: opts.merge });
  const cap = opts.cap ?? DEFAULT_CAP;
  const schedule = opts.schedule ?? defaultScheduler;
  const onError = opts.onError ?? defaultOnError;

  let running = false;
  let cancel: Cancel | null = null;
  let applied = 0;

  function drain(limit: number): void {
    const batch = buffer.drain(limit);
    if (batch.length === 0) return;
    try {
      opts.apply(batch);
      applied += batch.length;
    } catch (err) {
      onError(err);
    }
  }

  // Re-arm before applying so a throwing `apply` cannot silently kill the loop.
  const frame = (): void => {
    if (!running) return;
    cancel = schedule(frame);
    drain(cap);
  };

  return {
    push(key, patch) {
      buffer.push(key, patch);
    },
    start() {
      if (running) return;
      running = true;
      cancel = schedule(frame);
    },
    stop(stopOpts = {}) {
      running = false;
      cancel?.();
      cancel = null;
      if (stopOpts.discard) buffer.clear();
    },
    flushNow() {
      drain(Number.POSITIVE_INFINITY);
    },
    get pending() {
      return buffer.size;
    },
    get applied() {
      return applied;
    },
    get running() {
      return running;
    },
  };
}

/** Index rows by id so a patch finds its row in O(1). Rebuild it when the row
    set changes (symbols added or removed), not on every tick. */
export function createRowIndex<R, K>(rows: readonly R[], getRowId: (row: R) => K): Map<K, R> {
  const index = new Map<K, R>();
  for (const row of rows) index.set(getRowId(row), row);
  return index;
}

/**
 * Write coalesced patches onto their rows, in place.
 *
 * Fields whose value is unchanged are skipped — with Svelte's deep `$state`
 * proxies an assignment is a reactive write even when the value is identical, so
 * skipping is what keeps an idle-but-chatty feed from re-rendering (and, with
 * derived flash, from flashing cells that did not move). Patches for unknown ids
 * are ignored; returns how many found a row.
 */
export function applyPatches<R extends Record<string, unknown>, K>(
  index: Map<K, R>,
  batch: Array<[K, Partial<R>]>,
): number {
  let hits = 0;
  for (const [key, patch] of batch) {
    const row = index.get(key);
    if (row === undefined) continue;
    hits++;
    for (const field in patch) {
      const next = patch[field];
      if (next !== undefined && !Object.is(row[field], next)) {
        (row as Record<string, unknown>)[field] = next;
      }
    }
  }
  return hits;
}
