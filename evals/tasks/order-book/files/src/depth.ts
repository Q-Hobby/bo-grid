// A depth feed. connectDepth() sends a snapshot of the order book, then
// updates with the price levels that changed. Prices and sizes are strings;
// a size of "0" removes the level. Updates are numbered: `from` is the first
// sequence number an update covers and `seq` the last, so the next update's
// `from` is this one's `seq` + 1.
export type Level = [price: string, size: string];
export type DepthMessage =
  | { type: 'snapshot'; bids: Level[]; asks: Level[]; seq: number }
  | { type: 'update'; bids: Level[]; asks: Level[]; from: number; seq: number };

const listeners = new Set<(m: DepthMessage) => void>();
let connections = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/** Connects to the feed, and returns a function that disconnects. */
export function connectDepth(onMessage: (m: DepthMessage) => void): () => void {
  connections++;
  listeners.add(onMessage);
  // A simulated market. Set globalThis.__MANUAL_FEED__ to drive it with emitDepth().
  if (!(globalThis as { __MANUAL_FEED__?: boolean }).__MANUAL_FEED__) simulate(onMessage);
  return () => {
    listeners.delete(onMessage);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** How many times connectDepth() has been called. */
export function connectionCount(): number {
  return connections;
}

/** Sends one message to every connection. */
export function emitDepth(m: DepthMessage): void {
  for (const l of [...listeners]) l(m);
}

function simulate(onMessage: (m: DepthMessage) => void): void {
  const level = (p: number): Level => [p.toFixed(1), String(1 + Math.floor(Math.random() * 20))];
  let seq = 1;
  setTimeout(() => {
    onMessage({
      type: 'snapshot',
      bids: Array.from({ length: 30 }, (_, i) => level(100 - i * 0.5)),
      asks: Array.from({ length: 30 }, (_, i) => level(100.5 + i * 0.5)),
      seq,
    });
    timer ??= setInterval(() => {
      const from = seq + 1;
      seq = from + Math.floor(Math.random() * 3);
      const near = (best: number, away: 1 | -1) => level(best + away * Math.round(Math.random() * 29) * 0.5);
      emitDepth({ type: 'update', bids: [near(100, -1), near(100, -1)], asks: [near(100.5, 1), near(100.5, 1)], from, seq });
    }, 50);
  }, 0);
}
