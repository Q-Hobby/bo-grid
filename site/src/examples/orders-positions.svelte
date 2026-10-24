<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { createLinger } from 'bo-grid/realtime';
  import { createPositions, unrealizedPnl } from 'bo-grid/trading';

  type Order = { id: number; symbol: string; side: 'buy' | 'sell'; qty: number; price: number; status: string };
  let nextId = 1;
  const order = (side: Order['side']): Order => ({ id: nextId++, symbol: 'FPT', side, qty: 100 * Math.ceil(Math.random() * 5), price: Math.round((131 + Math.random() * 2) * 10) / 10, status: 'Working' });
  let orders = $state.raw<Order[]>([order('buy'), order('sell'), order('buy')]);

  // A done order stays 1.5 s, dimmed, instead of vanishing from under the eye.
  let expired = $state(0);
  const linger = createLinger<Order, number>({ ms: 1500, key: (o) => o.id, onExpire: () => expired++ });
  const shown = $derived.by(() => {
    void expired; // updates again when a row is due to go
    return linger.update(orders);
  });
  const rowClass = $derived.by(() => {
    void shown; // a new function per update, so the leaving rows restyle
    return (o: GridRow) => (linger.leaving(o as Order) ? 'leaving' : undefined);
  });

  // Positions on average cost, from the fills.
  const book = createPositions();
  let position = $state(book.get('FPT'));

  const columns: ColumnDef[] = [
    { type: 'number', key: 'id', header: '#', width: 56, decimals: 0 },
    { type: 'badge', key: 'side', header: 'Side', width: 80, tones: { buy: 'up', sell: 'down' } },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0, groupAgg: 'sum' },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'badge', key: 'status', header: 'Status', flex: 1, tones: { Working: 'info', Filled: 'up' } },
  ];

  $effect(() => {
    const timer = setInterval(() => {
      // A Filled order leaves the list on the next update, and lingers as Filled.
      const open = orders.filter((o) => o.status !== 'Filled');
      const fill = open.find((o) => Math.random() < 0.4);
      if (fill) {
        book.fill({ symbol: fill.symbol, side: fill.side, qty: fill.qty, price: fill.price });
        position = book.get('FPT'); // a copy
        orders = open.map((o) => (o === fill ? { ...o, status: 'Filled' } : o));
      } else {
        orders = open.length < 6 ? [...open, order(Math.random() < 0.6 ? 'buy' : 'sell')] : open;
      }
    }, 900);
    return () => clearInterval(timer);
  });
</script>

<p class="note">
  FPT position <b>{position?.qty ?? 0}</b> at {position ? position.avgPrice.toFixed(2) : '–'} · realized {position?.realized.toFixed(0) ?? 0} · unrealized at 132: {position ? unrealizedPnl(position, 132).toFixed(0) : 0}
</p>
<div class="blotter"><Grid rows={shown} {columns} {rowClass} height={260} footer flashNewRows /></div>

<style>
  .note {
    margin: 0 0 8px;
    font-size: 12px;
  }
  .blotter :global(.leaving) {
    opacity: 0.45;
  }
</style>
