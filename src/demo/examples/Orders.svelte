<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Grid, type ColumnDef, type GridRow, type SortState } from '../../lib';
  import { createLinger } from '../../lib/realtime';
  import { createPositions, unrealizedPnl, type Position } from '../../lib/trading';
  import { ui } from '../theme.svelte';

  // Working orders and the positions their fills build, as a desk sees them.
  //  - Orders: status chips (a `badge` column), new orders flash once
  //    (`flashNewRows`), and an order that is done stays a moment, dimmed,
  //    before it goes (`createLinger`): it is marked Filled or Cancelled
  //    first, leaves the working list on the next beat, and lingers as shown.
  //  - Positions: average cost from the fills (`createPositions`), marked at
  //    the last price as a field of each row, so the unrealized P&L column
  //    and the footer totals follow every tick.
  interface Order extends GridRow {
    id: number;
    time: string;
    symbol: string;
    side: 'Buy' | 'Sell';
    qty: number;
    filled: number;
    price: number;
    status: 'Working' | 'Partial' | 'Filled' | 'Cancelled';
  }
  interface PositionRow extends Position {
    id: number;
    last: number;
  }

  let seed = 0x0d3c;
  function rand(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const SYMS = ['FPT', 'VNM', 'HPG', 'MWG', 'VCB', 'TCB'];
  const last = new Map<string, number>(SYMS.map((s, i) => [s, 20 + i * 15]));
  const round = (p: number) => Math.round(p * 20) / 20;

  let clock = Date.UTC(2026, 9, 24, 2, 15, 0);
  const hhmmss = (t: number) => new Date(t).toISOString().slice(11, 19);
  let nextId = 1;
  function newOrder(): Order {
    const symbol = SYMS[Math.floor(rand() * SYMS.length)];
    const side = rand() < 0.5 ? 'Buy' : 'Sell';
    const off = (side === 'Buy' ? -1 : 1) * Math.floor(rand() * 3) * 0.05;
    return { id: nextId++, time: hhmmss(clock), symbol, side, qty: (1 + Math.floor(rand() * 8)) * 100, filled: 0, price: round(last.get(symbol)! + off), status: 'Working' };
  }

  let orders = $state.raw<Order[]>(Array.from({ length: 7 }, newOrder));
  const book = createPositions();
  let positions = $state.raw<PositionRow[]>([]);
  function markPositions(): void {
    positions = book.all().map((p) => ({ ...p, id: SYMS.indexOf(p.symbol), last: last.get(p.symbol)! }));
  }

  // Done orders linger 1.8 s; `expired` asks for a new update when one is due.
  let expired = $state(0);
  const linger = createLinger<Order, number>({ ms: 1800, key: (o) => o.id, onExpire: () => expired++ });
  onDestroy(linger.stop);
  const shown = $derived.by(() => {
    void expired;
    return linger.update(orders);
  });
  // A new function with each update, so the grid restyles the rows leaving.
  const orderClass = $derived.by(() => {
    void shown;
    return (r: GridRow) => (linger.leaving(r as Order) ? 'ord-leaving' : undefined);
  });

  function step(): void {
    clock += 1000;
    for (const s of SYMS) if (rand() < 0.5) last.set(s, Math.max(1, round(last.get(s)! + (rand() < 0.5 ? -0.05 : 0.05))));
    const next: Order[] = [];
    for (const o of orders) {
      // Done on the last beat: off the working list now (it lingers).
      if (o.status === 'Filled' || o.status === 'Cancelled') continue;
      const px = last.get(o.symbol)!;
      const marketable = o.side === 'Buy' ? o.price >= px : o.price <= px;
      if (marketable && rand() < 0.6) {
        const qty = Math.min(o.qty - o.filled, (1 + Math.floor(rand() * 3)) * 100);
        book.fill({ symbol: o.symbol, side: o.side === 'Buy' ? 'buy' : 'sell', qty, price: o.price });
        const filled = o.filled + qty;
        next.push({ ...o, filled, status: filled >= o.qty ? 'Filled' : 'Partial' });
      } else if (rand() < 0.03) next.push({ ...o, status: 'Cancelled' });
      else next.push(o);
    }
    if (rand() < 0.45) next.unshift(newOrder());
    orders = next;
    markPositions();
  }

  let live = $state(true);
  $effect(() => {
    if (!live) return;
    const h = setInterval(step, 400);
    return () => clearInterval(h);
  });

  const sort: SortState[] = [{ key: 'id', dir: 'desc' }];
  const orderColumns: ColumnDef[] = [
    { type: 'number', key: 'id', header: '#', width: 52, decimals: 0 },
    { type: 'text', key: 'time', header: 'Time', width: 84 },
    { type: 'text', key: 'symbol', header: 'Symbol', width: 72 },
    { type: 'badge', key: 'side', header: 'Side', width: 64, tones: { Buy: 'up', Sell: 'down' } },
    { type: 'number', key: 'qty', header: 'Qty', width: 64, decimals: 0 },
    { type: 'progress', key: 'fillPct', header: 'Filled', width: 96, min: 0, max: 100, value: (r) => (100 * (r as Order).filled) / (r as Order).qty },
    { type: 'number', key: 'price', header: 'Price', width: 72, decimals: 2 },
    { type: 'badge', key: 'status', header: 'Status', width: 96, tones: { Working: 'info', Partial: 'amber', Filled: 'up', Cancelled: 'neutral' } },
  ];
  const tone = (v: unknown) => (Number(v) > 0 ? 'pnl-up' : Number(v) < 0 ? 'pnl-down' : undefined);
  const positionColumns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 72 },
    { type: 'number', key: 'qty', header: 'Position', width: 84, decimals: 0, cellClass: tone },
    { type: 'number', key: 'avgPrice', header: 'Avg price', width: 88, decimals: 2 },
    { type: 'number', key: 'last', header: 'Last', width: 72, decimals: 2, flash: 'auto' },
    { type: 'number', key: 'unrealized', header: 'Unrealized', width: 104, decimals: 2, value: (r) => unrealizedPnl(r as unknown as PositionRow, (r as unknown as PositionRow).last), groupAgg: 'sum', cellClass: tone },
    { type: 'number', key: 'realized', header: 'Realized', width: 96, decimals: 2, groupAgg: 'sum', cellClass: tone },
  ];
</script>

<div class="controls">
  <button class="live" class:on={live} onclick={() => (live = !live)}>
    <span class="dot"></span>{live ? 'Live' : 'Paused'}
  </button>
  <span class="stat"><strong>{orders.length}</strong> working · <strong>{linger.size}</strong> leaving · <strong>{positions.length}</strong> positions</span>
</div>

<div class="desk">
  <section>
    <h4>Working orders</h4>
    <Grid rows={shown} columns={orderColumns} {sort} flashNewRows flashMotion="auto" rowClass={orderClass} height={300} rowHeight={30} theme={ui.grid} ariaLabel="Working orders" />
  </section>
  <section>
    <h4>Positions</h4>
    <Grid rows={positions as unknown as GridRow[]} columns={positionColumns} footer height={210} rowHeight={30} theme={ui.grid} ariaLabel="Positions" />
  </section>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .stat strong {
    color: var(--text);
  }
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
  .desk {
    display: grid;
    gap: 18px;
  }
  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .desk :global(.row.ord-leaving) {
    opacity: 0.45;
  }
  .desk :global(.row.ord-leaving .c) {
    text-decoration: line-through;
  }
  .desk :global(.pnl-up) {
    color: var(--up);
  }
  .desk :global(.pnl-down) {
    color: var(--down);
  }
</style>
