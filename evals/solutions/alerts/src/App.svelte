<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createAlerts, createTickStream } from 'bo-grid/realtime';
  import { SYMBOLS, subscribe, type Quote } from './feed';
  import { levels } from './levels';

  type Row = GridRow & { id: string; last?: number };
  const rows: Row[] = $state.raw(SYMBOLS.map((symbol) => ({ id: symbol })));
  const columns: ColumnDef[] = [
    { type: 'text', key: 'id', header: 'Symbol' },
    { type: 'price', key: 'last', header: 'Last', flash: 'auto' },
  ];

  let version = $state(0);
  const alerts = createAlerts<Row, string>({
    key: (r) => r.id,
    rules: {
      above: (r) => r.last !== undefined && r.last >= levels[r.id].above,
      below: (r) => r.last !== undefined && r.last <= levels[r.id].below,
    },
    onChange: () => version++,
  });
  const rowClass = $derived.by(() => {
    void version;
    return (r: GridRow) => (alerts.isLit(r as Row) ? 'alert-lit' : undefined);
  });

  let api: GridApi | undefined;
  const stream = createTickStream<string, Partial<Quote>>({
    apply: (batch) => {
      api?.patchRows(batch);
      alerts.check(rows);
    },
  });
  $effect(() => {
    stream.start();
    const stop = subscribe((q) => stream.push(q.symbol, { last: q.last }));
    return () => {
      stop();
      stream.stop();
    };
  });
</script>

<main>
  <h1>Alerts</h1>
  <button onclick={() => alerts.ackAll()}>Acknowledge all</button>
  <Grid {rows} {columns} {rowClass} hotkeys={{ a: ({ row }) => void (row && alerts.ack(String(row.id))) }} onReady={(a) => (api = a)} height={400} />
</main>

<style>
  :global(.bo-grid .row.alert-lit) {
    background: color-mix(in srgb, var(--bo-down) 25%, transparent);
  }
</style>
