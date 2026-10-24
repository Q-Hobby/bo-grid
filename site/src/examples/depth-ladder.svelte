<script lang="ts">
  import { DepthLadder, type BookLevel, type LadderAction, type LadderOrder } from 'bo-grid/ladder';

  // A simulated book around a drifting mid price; in an app, your depth feed.
  const TICK = 0.05;
  let mid = $state(25);
  let bids = $state.raw<BookLevel[]>([]);
  let asks = $state.raw<BookLevel[]>([]);
  let last = $state(25);
  let orders = $state.raw<LadderOrder[]>([{ id: 1, side: 'buy', price: 24.8, qty: 5 }]);
  let following = $state(true);
  let nextId = 2;

  const round = (p: number) => Math.round(p / TICK) * TICK;
  function reprice(): void {
    if (Math.random() < 0.2) mid = round(mid + (Math.random() < 0.5 ? -TICK : TICK));
    bids = Array.from({ length: 30 }, (_, i): BookLevel => [round(mid - TICK * (i + 1)), Math.ceil(Math.random() * 30 + i * 2)]);
    asks = Array.from({ length: 30 }, (_, i): BookLevel => [round(mid + TICK * (i + 1)), Math.ceil(Math.random() * 30 + i * 2)]);
    if (Math.random() < 0.5) last = Math.random() < 0.5 ? bids[0][0] : asks[0][0];
  }
  reprice();

  // The ladder only reports what the user asked for; the app places orders.
  function onAction(a: LadderAction): void {
    if (a.kind === 'cancel') {
      const gone = new Set(a.orders.map((o) => o.id));
      orders = orders.filter((o) => !gone.has(o.id));
    } else {
      orders = [...orders, { id: nextId++, side: a.kind, price: a.price, qty: 1 }];
    }
  }

  $effect(() => {
    const timer = setInterval(reprice, 400);
    return () => clearInterval(timer);
  });
</script>

<p class="note">Click a bid size to buy, an ask size to sell, your order to cancel (or B, S, Delete on the focused row). The wheel pages; Space recentres. {following ? 'Following the market.' : 'Paged away.'}</p>
<DepthLadder {bids} {asks} {last} {orders} tick={TICK} rows={13} rowHeight={24} bind:following {onAction} />

<style>
  .note {
    margin: 0 0 8px;
    font-size: 12px;
    opacity: 0.8;
  }
</style>
