// The worker reads the feed: here a simulated socket sending JSON text, in
// an app a WebSocket. Parsing and coalescing happen on this thread; the page
// takes one batch a frame.
import { serveFeed } from 'bo-grid/realtime';
import { SYMBOLS, seed, type Tick } from './worker-feed-data';

const feed = serveFeed<number, Tick>();
const quotes = Array.from({ length: SYMBOLS }, (_, id) => ({ ref: seed(id).price, price: seed(id).price, volume: 0 }));

let perSecond = 5000;
self.addEventListener('message', (e: MessageEvent) => {
  if (typeof e.data?.perSecond === 'number') perSecond = e.data.perSecond;
});

function onMessage(text: string): void {
  const m = JSON.parse(text);
  const ref = quotes[m.id].ref;
  feed.push(m.id, { price: m.p, change: Math.round(((m.p - ref) / ref) * 10_000) / 100, volume: m.v });
}

setInterval(() => {
  for (let n = 0; n < perSecond / 20; n++) {
    const id = Math.floor(Math.random() * SYMBOLS);
    const q = quotes[id];
    q.price = Math.max(0.01, Math.round(q.price * (1 + (Math.random() - 0.5) * 0.004) * 100) / 100);
    q.volume += 100;
    onMessage(JSON.stringify({ id, p: q.price, v: q.volume }));
  }
}, 50);
