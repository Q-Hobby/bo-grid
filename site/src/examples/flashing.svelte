<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { quotes } from './data';

  // Bid and ask flash by direction, each cell on its own; Status flashes
  // amber on any change. The rows are $state, so a write is all it takes.
  const STATUSES = ['Open', 'Halted', 'Auction'];
  const rows = $state(quotes().slice(0, 8).map((q) => ({ ...q, bid: q.price - 0.05, ask: q.price + 0.05, status: 'Open' })));
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    { type: 'price', key: 'bid', header: 'Bid', flash: 'auto' },
    { type: 'price', key: 'ask', header: 'Ask', flash: 'auto' },
    { type: 'text', key: 'status', header: 'Status', flash: 'change', flashMs: 900 },
    { type: 'text', key: 'name', header: 'Name', flex: 1 },
  ];

  let motion = $state<'fade' | 'hold'>('fade');
  let api: GridApi | undefined;

  $effect(() => {
    const timer = setInterval(() => {
      const r = rows[Math.floor(Math.random() * rows.length)];
      const move = Math.round((Math.random() - 0.5) * 4) * 0.05;
      r.bid = Math.round((r.bid + move) * 100) / 100;
      r.ask = Math.round((r.ask + move + (Math.random() < 0.3 ? 0.05 : 0)) * 100) / 100;
      if (Math.random() < 0.05) r.status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    }, 120);
    return () => clearInterval(timer);
  });
</script>

<div class="bar">
  <button onclick={() => api?.flashCells({ rows: [rows[0].id] })}>Flash VNM's row</button>
  <button onclick={() => api?.flashCells({ rows: rows.map((r) => r.id), columns: ['symbol'], dir: 'up', ms: 1200 })}>Flash every symbol as a rise</button>
  <label>Motion <select bind:value={motion}><option>fade</option><option>hold</option></select></label>
</div>
<Grid {rows} {columns} height={300} flashMotion={motion} onReady={(a) => (api = a)} />

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: 12px;
  }
  button,
  select {
    font: inherit;
  }
</style>
