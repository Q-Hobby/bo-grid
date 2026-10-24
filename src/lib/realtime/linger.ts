// Rows that leave a live list stay a moment, so a filled or cancelled order
// is seen going instead of vanishing from under the eye.
//
// Hand `update` the list you have; it returns that list plus the rows that
// left it within the last `ms`, each where it was, so nothing else moves until
// it goes. `leaving(row)` says which ones to style. When the first of them is
// due to go, `onExpire` asks you to call `update` again.
//
//   let expired = $state(0);
//   const linger = createLinger({ ms: 1500, key: (o) => o.id, onExpire: () => expired++ });
//   const shown = $derived.by(() => {
//     void expired; // updates again when a row is due to go
//     return linger.update(orders);
//   });
//   // A new function per update, so the grid restyles the rows that left:
//   const rowClass = $derived.by(() => {
//     void shown;
//     return (o) => (linger.leaving(o) ? 'leaving' : undefined);
//   });
//   <Grid rows={shown} {rowClass} ... />
//   onDestroy(linger.stop);
//
// A row that comes back (same key) before its time is up is simply there
// again. Keys must be unique within a list. `leaving` compares the row
// object itself, as `update` returned it. Rows still on their way out count
// in footer totals like any other.
import { boError } from '../errors';

export interface LingerOptions<R, K> {
  /** How long a row that left stays, in ms. */
  ms: number;
  /** The identity of a row (its order id). */
  key: (row: R) => K;
  /** Called when a row is due to go: call `update` again. */
  onExpire?: () => void;
}

export interface Linger<R> {
  /** `rows` plus the rows that left within `ms`, each where it was. */
  update(rows: readonly R[]): R[];
  /** Whether `row` is one that has left and is on its way out. */
  leaving(row: R): boolean;
  /** Rows on their way out. */
  readonly size: number;
  /** Drops the rows on their way out and the pending `onExpire`. */
  stop(): void;
}

/** Where rows leaving before the first row that stays go. */
const FIRST = Symbol('first');

export function createLinger<R, K>(opts: LingerOptions<R, K>): Linger<R> {
  const { ms, key, onExpire } = opts;
  if (!(ms >= 0) || !Number.isFinite(ms)) throw boError(RangeError, 'BG2003', `createLinger: ms must be a finite number of 0 or more, got ${ms}.`, 'Pass how long a row lingers in milliseconds, e.g. ms: 3000 (0 removes it at once).');
  // Rows on their way out, and when they left.
  const gone = new Map<K, { row: R; at: number }>();
  let shown: readonly R[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(now: number): void {
    clearTimeout(timer);
    timer = undefined;
    if (gone.size === 0 || !onExpire) return;
    let due = Infinity;
    for (const g of gone.values()) due = Math.min(due, g.at + ms);
    timer = setTimeout(() => {
      timer = undefined;
      onExpire();
    }, Math.max(0, due - now));
  }

  return {
    update(rows) {
      const now = Date.now();
      const here = new Set<K>();
      for (const r of rows) here.add(key(r));
      // Rows that came back are simply there again.
      for (const k of gone.keys()) if (here.has(k)) gone.delete(k);
      // Rows that just left start their time.
      for (const r of shown) {
        const k = key(r);
        if (!here.has(k) && !gone.has(k)) gone.set(k, { row: r, at: now });
      }
      for (const [k, g] of gone) if (now - g.at >= ms) gone.delete(k);
      let out: R[];
      if (gone.size === 0) out = rows.slice();
      else {
        // Each goes back right after the row that stays and came before it
        // (or first), in the order they stood, so rows that arrive elsewhere
        // do not move it. One pass over each list.
        const after = new Map<K | typeof FIRST, R[]>();
        let anchor: K | typeof FIRST = FIRST;
        for (const r of shown) {
          const k = key(r);
          if (gone.get(k)?.row === r) {
            const list = after.get(anchor);
            if (list) list.push(r);
            else after.set(anchor, [r]);
          } else if (here.has(k)) anchor = k;
        }
        out = [...(after.get(FIRST) ?? [])];
        for (const r of rows) {
          out.push(r);
          const k = key(r);
          const list = after.get(k);
          if (list) {
            out.push(...list);
            after.delete(k);
          }
        }
      }
      shown = out;
      schedule(now);
      return out;
    },
    leaving(row) {
      return gone.get(key(row))?.row === row;
    },
    get size() {
      return gone.size;
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
      gone.clear();
      shown = [];
    },
  };
}
