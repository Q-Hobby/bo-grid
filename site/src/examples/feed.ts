// A simulated market feed for the docs' examples: a random walk on each
// quote's price. In an app, this is your socket's message handler.
import type { Quote } from './data';

export type Tick = { price: number; change: number; volume: number };

/** Calls `onTick` about `perSecond` times a second, for a random row each
    time. Returns a function that stops the feed. */
export function simulateFeed(rows: readonly Quote[], onTick: (id: number, tick: Tick) => void, perSecond = 20): () => void {
  const state = rows.map((r) => ({ id: r.id, ref: r.price / (1 + r.change / 100), price: r.price, volume: r.volume }));
  const every = 50;
  let due = 0;
  const timer = setInterval(() => {
    for (due += (perSecond * every) / 1000; due >= 1; due--) {
      const s = state[Math.floor(Math.random() * state.length)];
      s.price = Math.max(0.01, Math.round(s.price * (1 + (Math.random() - 0.5) * 0.006) * 100) / 100);
      s.volume += Math.ceil(Math.random() * 40) * 100;
      onTick(s.id, { price: s.price, change: Math.round(((s.price - s.ref) / s.ref) * 10_000) / 100, volume: s.volume });
    }
  }, every);
  return () => clearInterval(timer);
}
