<script lang="ts">
  import { Grid, fmtPrice, type ColumnDef, type GridRow } from '../../lib';
  import { TradeTape } from '../../lib/realtime';
  import { ui } from '../theme.svelte';

  // Time & sales: every trade shows (nothing coalesces, unlike a price feed) —
  // `TradeTape` is a capped ring buffer, newest trade first, O(1) per push
  // regardless of session length. New trades simply appear at the top of the
  // list as the array is reassigned; no per-cell flash bookkeeping needed for
  // a row that didn't exist a moment ago.
  interface Trade extends GridRow {
    ts: number;
    price: number;
    size: number;
    side: 'buy' | 'sell';
  }

  const CAPACITY = 200;
  const MID = 250;

  const tape = new TradeTape<Trade>(CAPACITY);
  let nextId = 0;
  let price = $state(MID);

  function makeTrade(): Trade {
    const move = (Math.random() - 0.5) * 0.6;
    price = Math.max(10, price + move);
    const side: Trade['side'] = move >= 0 ? 'buy' : 'sell';
    return {
      id: nextId++,
      ts: Date.now(),
      price: Math.round(price * 100) / 100,
      size: 10 + Math.floor(Math.random() * 490),
      side,
    };
  }

  let rows = $state<Trade[]>([]);
  const gridRows = $derived(rows as unknown as GridRow[]);

  const columns: ColumnDef[] = [
    { type: 'custom', key: 'ts', header: 'Time', width: 84, sortable: false },
    { type: 'price', key: 'price', header: 'Price', width: 90, sortable: false },
    { type: 'volume', key: 'size', header: 'Size', width: 84, sortable: false },
    { type: 'badge', key: 'side', header: 'Side', width: 76, sortable: false,
      tones: { buy: 'up', sell: 'down' } },
  ];

  let live = $state(false);
  $effect(() => {
    if (!live) return;
    const h = setInterval(() => {
      tape.push(makeTrade());
      rows = tape.toArray(); // fresh snapshot each tick — a plain reassignment
    }, 180);
    return () => clearInterval(h);
  });

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  }
</script>

{#snippet cell({ row }: { row: GridRow })}
  {@const t = row as Trade}
  <span class="ts">{fmtTime(t.ts)}</span>
{/snippet}

<div class="controls">
  <span class="stat">Last <strong>{fmtPrice(price)}</strong></span>
  <span class="stat">Trades <strong>{tape.size}</strong> / {CAPACITY}</span>
  <button class="live" class:on={live} onclick={() => (live = !live)}>
    <span class="dot"></span>{live ? 'Live' : 'Paused'}
  </button>
</div>

<div class="gridwrap">
  <Grid rows={gridRows} {columns} fitColumns theme={ui.grid} height={480} rowHeight={30} {cell} />
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .stat strong {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .ts {
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
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
  .gridwrap {
    max-width: 480px;
  }
</style>
