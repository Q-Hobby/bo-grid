<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { TradeTape } from 'bo-grid/realtime';

  interface Trade extends GridRow {
    id: number;
    symbol: string;
    price: number;
    size: number;
  }

  const keep = Number(new URLSearchParams(location.search).get('keep') ?? 500);
  const tape = new TradeTape<Trade>(keep);
  tape.push({ id: 1, symbol: 'AAPL', price: 189.3, size: 100 });
  tape.push({ id: 2, symbol: 'AAPL', price: 189.35, size: 250 });

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'volume', key: 'size', header: 'Size' },
  ];
  let rows: GridRow[] = $state(tape.toArray());
</script>

<main>
  <h1>Time and sales</h1>
  <Grid {rows} {columns} height={400} />
</main>
