// The market-data feed. subscribe() calls onQuote for every update, many
// times a second, and returns a function that stops it.
export type Quote = {
  symbol: string;
  last: number;
  volume: number;
};

export const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOG', 'NFLX'];

const listeners = new Set<(q: Quote) => void>();
const prices = new Map(SYMBOLS.map((s, i) => [s, 100 + i * 25]));
let timer: ReturnType<typeof setInterval> | undefined;

export function subscribe(onQuote: (q: Quote) => void): () => void {
  listeners.add(onQuote);
  // A simulated market. Set globalThis.__MANUAL_FEED__ to drive it with emit().
  if (!(globalThis as { __MANUAL_FEED__?: boolean }).__MANUAL_FEED__)
    timer ??= setInterval(() => {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const last = Math.round((prices.get(symbol)! + (Math.random() - 0.5)) * 100) / 100;
      prices.set(symbol, last);
      emit({ symbol, last, volume: Math.floor(Math.random() * 1000) });
    }, 2);
  return () => {
    listeners.delete(onQuote);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Sends one quote to every subscriber. */
export function emit(q: Quote): void {
  for (const l of listeners) l(q);
}
