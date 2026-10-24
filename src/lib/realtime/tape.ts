// A capped time & sales tape.
//
// Different discipline from `TickBuffer`/`createTickStream`: a price update
// collapses to its latest value (a tape entry never does — every trade must
// show, so there's nothing to coalesce). What a tape needs instead is a
// bounded ring buffer: append forever, keep only the newest N, O(1) per push
// regardless of how long the session runs.
import { boError } from '../errors';

const DEFAULT_CAPACITY = 500;

/**
 * A fixed-capacity, append-only trade log. `push` is O(1) (a true ring
 * buffer, not a shift-and-truncate array) — safe to call on every trade of a
 * busy tape without the per-push cost growing over a long session.
 *
 * `toArray()` materializes a snapshot **newest first** (the time & sales
 * convention — most recent trade at the top) each time it's called; call it
 * once per render, not per trade.
 */
export class TradeTape<T> {
  readonly capacity: number;
  private readonly buf: (T | undefined)[];
  private head = 0; // index the NEXT push writes to
  private count = 0;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    // A capacity <= 0 breaks the ring's modulo arithmetic silently (`% 0` is
    // NaN, so `head` would corrupt every subsequent push while `size` stayed
    // stuck at 0 forever) rather than throwing — exactly the "wrong, not
    // failing loudly" class of bug that's easy to miss in review. Reject it
    // up front instead.
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw boError(RangeError, 'BG2004', `TradeTape: capacity must be a number of 1 or more, got ${capacity}.`, 'Pass how many trades to keep, e.g. new TradeTape(500).');
    }
    this.capacity = Math.floor(capacity);
    this.buf = new Array(this.capacity);
  }

  /** Number of trades currently held (grows to `capacity`, then stays there). */
  get size(): number {
    return this.count;
  }

  push(trade: T): void {
    this.buf[this.head] = trade;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** A fresh array, newest trade first. Mutating the returned array does not
      affect the tape. */
  toArray(): T[] {
    const out: T[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      // The most recent write is one slot behind `head`; walk backwards from
      // there, wrapping around the ring.
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      out[i] = this.buf[idx] as T;
    }
    return out;
  }

  clear(): void {
    this.buf.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}
