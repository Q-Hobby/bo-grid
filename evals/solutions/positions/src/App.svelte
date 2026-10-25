<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { positions } from './positions';

  const rows: GridRow[] = positions.map((p) => ({ id: p.symbol, ...p }));
  const tone = (v: unknown) => (Number(v) > 0 ? 'pnl-up' : Number(v) < 0 ? 'pnl-down' : undefined);
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0 },
    { type: 'price', key: 'avg', header: 'Avg price' },
    { type: 'price', key: 'last', header: 'Last' },
    { type: 'number', key: 'pnl', header: 'P&L', value: (r) => Number(r.qty) * (Number(r.last) - Number(r.avg)), cellClass: tone },
  ];
</script>

<main>
  <h1>Positions</h1>
  <Grid {rows} {columns} height={300} />
</main>

<style>
  :global(.pnl-up) {
    color: var(--bo-up);
  }
  :global(.pnl-down) {
    color: var(--bo-down);
  }
</style>
