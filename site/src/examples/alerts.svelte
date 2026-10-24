<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createAlerts, createTickStream } from 'bo-grid/realtime';
  import { quotes, type Quote } from './data';
  import { simulateFeed, type Tick } from './feed';

  type Row = Quote & { above: number; below: number };
  const rows = $state.raw<Row[]>(quotes().slice(0, 8).map((q) => ({ ...q, above: Math.round(q.price * 1.004 * 100) / 100, below: Math.round(q.price * 0.996 * 100) / 100 })));

  // A rule fires when it turns true; the row stays lit until acknowledged.
  let version = $state(0);
  const alerts = createAlerts<Row, number>({
    key: (r) => r.id,
    rules: { above: (r) => r.price >= r.above, below: (r) => r.price <= r.below },
    onChange: () => version++,
  });
  const rowClass = $derived.by(() => {
    void version; // a new function when an alert fires or is acknowledged
    return (r: GridRow) => (alerts.isLit(r as Row) ? 'alert-lit' : undefined);
  });
  const active = $derived.by(() => {
    void version;
    return alerts.active(); // newest first
  });

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    { type: 'price', key: 'price', header: 'Last', flash: 'auto' },
    { type: 'price', key: 'below', header: 'Alert below' },
    { type: 'price', key: 'above', header: 'Alert above', flex: 1 },
  ];

  let api: GridApi | undefined;
  const stream = createTickStream<number, Tick>({
    apply: (batch) => {
      api?.patchRows(batch);
      alerts.check(rows); // the rows hold the new prices now
    },
  });
  $effect(() => {
    stream.start();
    const stop = simulateFeed(rows, (id, t) => stream.push(id, t), 12);
    return () => {
      stop();
      stream.stop();
    };
  });
</script>

<div class="bar">
  <span>{active.length} lit{active.length ? ':' : ''} {active.slice(0, 4).map((a) => `${a.row.symbol} ${a.rule}`).join(', ')}</span>
  <button onclick={() => alerts.ackAll()} disabled={!active.length}>Acknowledge all</button>
  <span class="hint">or focus a row and press A</span>
</div>
<div class="watch">
  <Grid {rows} {columns} {rowClass} height={8 * 36} hotkeys={{ a: ({ row }) => void (row && alerts.ack(row.id)) }} onReady={(a) => (api = a)} />
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 0 0 8px;
    font-size: 12px;
  }
  button {
    font: inherit;
  }
  .hint {
    opacity: 0.6;
  }
  .watch :global(.alert-lit) {
    box-shadow: inset 3px 0 0 var(--bo-amber);
    background: color-mix(in srgb, var(--bo-amber) 14%, transparent);
  }
</style>
