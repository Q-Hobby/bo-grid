<script lang="ts">
  import { Grid, type ColumnDef, type GridRow, type RowSource } from '../../lib';
  import { ui } from '../theme.svelte';

  // One million rows, never materialized. The RowSource generates only the
  // requested window on demand (deterministically from the row index), so the
  // grid scrolls a 1,000,000-row "trade tape" while holding ~a screenful in
  // memory. A simulated latency shows the skeleton loading rows.
  const TOTAL = 1_000_000;
  const LATENCY_MS = 120;
  const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'META', 'GOOG', 'AMD', 'NFLX', 'INTC', 'BABA', 'ORCL'];
  const BASE = Date.UTC(2024, 0, 1);

  // Cheap integer hash → stable pseudo-random fields per index.
  function hash(i: number): number {
    let x = (i ^ 0x9e3779b9) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  function makeRow(i: number): GridRow {
    const h = hash(i);
    const price = 20 + (h % 48_000) / 100; // ~20–500
    const qty = 10 + (h % 2_000);
    return {
      id: i,
      flashSeq: 0,
      flashDir: 'up',
      seq: i + 1,
      symbol: SYMBOLS[h % SYMBOLS.length],
      side: h & 1 ? 'BUY' : 'SELL',
      price,
      qty,
      value: Math.round(price * qty),
      ts: BASE + i * 2_500, // 2.5s apart — a sequential tape
    } as GridRow;
  }

  // Read-only windowed source. Sort/filter are intentionally not implemented
  // (the columns are non-sortable) — this example is about scale + windowing.
  const source: RowSource = {
    getRows({ range }) {
      const rows: GridRow[] = [];
      for (let i = range.start; i < range.end && i < TOTAL; i++) rows.push(makeRow(i));
      return new Promise((resolve) =>
        setTimeout(() => resolve({ rows, total: TOTAL }), LATENCY_MS),
      );
    },
  };

  const columns: ColumnDef[] = [
    { type: 'number', key: 'seq', header: '#', width: 96, decimals: 0, sortable: false },
    { type: 'date', key: 'ts', header: 'Date', width: 104, dateStyle: 'short', sortable: false },
    { type: 'text', key: 'symbol', header: 'Symbol', width: 96, sortable: false },
    { type: 'custom', key: 'side', header: 'Side', width: 78, sortable: false },
    { type: 'price', key: 'price', header: 'Price', width: 100, sortable: false },
    { type: 'volume', key: 'qty', header: 'Qty', width: 96, sortable: false },
    { type: 'volume', key: 'value', header: 'Value', width: 120, sortable: false, flex: 1 },
  ];
</script>

{#snippet cell({ row }: { row: GridRow })}
  <span class="side" class:buy={row.side === 'BUY'} class:sell={row.side === 'SELL'}>
    {row.side}
  </span>
{/snippet}

<div class="controls">
  <span class="stat"><strong>{TOTAL.toLocaleString()}</strong> rows</span>
  <span class="dot">·</span>
  <span class="stat">windowed from a synthetic source (~{LATENCY_MS}ms latency)</span>
  <span class="dot">·</span>
  <span class="stat">only the visible window is ever in memory</span>
</div>

<div class="gridwrap">
  <Grid rows={[]} {columns} {source} fitColumns theme={ui.grid} height={620} {cell} />
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .stat strong {
    color: var(--up);
    font-variant-numeric: tabular-nums;
  }
  .dot {
    color: var(--border);
  }
  .side {
    padding: 1px 7px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    border-radius: 999px;
    color: var(--text-dim);
    background: var(--row-hover);
  }
  .side.buy {
    color: var(--on-up);
    background: var(--up);
  }
  .side.sell {
    color: var(--on-down);
    background: var(--down);
  }
  .gridwrap {
    max-width: 820px;
  }
</style>
