<script lang="ts">
  import { DepthLadder, type BookLevel, type LadderAction, type LadderOrder } from '../../lib/ladder';
  import { ui } from '../theme.svelte';

  // A depth ladder on a live book: one row per price, bid and ask sizes with
  // their depth, your working orders beside each side. It follows the middle
  // of the spread and recentres only when the market drifts out of the middle
  // half; it holds still under the pointer. The ladder only reports what the
  // user asked for; placing and cancelling is this demo's (a real app sends
  // the order and shows it once the venue acknowledges it).
  const TICK = 0.05;
  const DEPTH = 30; // levels per side

  let seed = 0x1add;
  function rand(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const size = () => (1 + Math.floor(rand() * 40)) * 25;
  const at = (i: number) => Math.round(i * TICK * 100) / 100;

  // The book, as levels around a mid (in ticks): bids below it, asks above.
  let midTicks = 5000; // 250.00
  function book(): { bids: BookLevel[]; asks: BookLevel[] } {
    const bids: BookLevel[] = [];
    const asks: BookLevel[] = [];
    for (let i = 1; i <= DEPTH; i++) {
      bids.push([at(midTicks - i), size()]);
      asks.push([at(midTicks + i), size()]);
    }
    return { bids, asks };
  }
  let { bids, asks } = $state.raw(book());
  let last = $state<number | undefined>(at(midTicks + 1));
  let orders = $state<LadderOrder[]>([
    { id: 1, side: 'buy', price: at(midTicks - 3), qty: 200 },
    { id: 2, side: 'sell', price: at(midTicks + 4), qty: 100 },
  ]);
  let nextId = 3;
  let following = $state(true);
  let note = $state('Click a bid or an ask to place an order, one of yours to cancel it.');

  function onAction(a: LadderAction): void {
    const p = a.price.toFixed(2);
    if (a.kind === 'cancel') {
      const gone = new Set(a.orders.map((o) => o.id));
      orders = orders.filter((o) => !gone.has(o.id));
      note = `Cancelled ${a.orders.length} order${a.orders.length > 1 ? 's' : ''} at ${p} (${a.via})`;
    } else {
      orders = [...orders, { id: nextId++, side: a.kind, price: a.price, qty: 100 }];
      note = `${a.kind === 'buy' ? 'Buy' : 'Sell'} 100 at ${p} (${a.via})`;
    }
  }

  // The feed: sizes change on every beat; now and then a trade prints and
  // the market moves a tick.
  let live = $state(true);
  $effect(() => {
    if (!live) return;
    const h = setInterval(() => {
      if (rand() < 0.12) midTicks += rand() < 0.5 ? -1 : 1;
      const next = book();
      // Keep most sizes from the last beat, so only some levels change.
      const keep = (prev: BookLevel[], fresh: BookLevel[]) => {
        const by = new Map(prev);
        return fresh.map(([p, s]) => [p, rand() < 0.75 ? (by.get(p) ?? s) : s] as const);
      };
      bids = keep(bids, next.bids);
      asks = keep(asks, next.asks);
      if (rand() < 0.4) last = at(midTicks + (rand() < 0.5 ? -1 : 1));
    }, 250);
    return () => clearInterval(h);
  });
</script>

<div class="controls">
  <button class="live" class:on={live} onclick={() => (live = !live)}>
    <span class="dot"></span>{live ? 'Live' : 'Paused'}
  </button>
  <button class="follow" class:on={following} onclick={() => (following = true)} disabled={following}>
    {following ? 'Following the market' : 'Recenter'}
  </button>
  <span class="note">{note}</span>
</div>

<DepthLadder {bids} {asks} {last} {orders} tick={TICK} bind:following {onAction} theme={ui.grid} />

<p class="hint">Keys on the focused row: <kbd>B</kbd> buy, <kbd>S</kbd> sell, <kbd>Delete</kbd> cancel. The wheel pages through prices; <kbd>Space</kbd> follows the market again.</p>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .follow,
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font: inherit;
    color: var(--text);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
  }
  .follow:disabled {
    color: var(--text-dim);
    cursor: default;
  }
  .live .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-dim);
  }
  .live.on .dot {
    background: var(--up);
    box-shadow: 0 0 6px var(--up);
  }
  .note {
    color: var(--text);
  }
  .hint {
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-dim);
  }
  kbd {
    font-family: var(--mono);
    font-size: 11px;
    padding: 0 4px;
    border: 0.5px solid var(--border);
    border-radius: 3px;
  }
</style>
