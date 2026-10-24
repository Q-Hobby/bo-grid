// The symbols the worker-feed example streams, shared by the page (its
// first rows) and the worker (its simulated socket).
export const SYMBOLS = 500;

export type Tick = { price: number; change: number; volume: number };

/** A symbol's name and opening price, the same on both sides. */
export function seed(id: number): { symbol: string; price: number } {
  const letters = 'ABCDEFGHKLMNPRSTVX';
  const symbol = letters[id % 18] + letters[Math.floor(id / 18) % 18] + letters[(id * 7) % 18];
  return { symbol, price: 10 + ((id * 37) % 190) };
}
